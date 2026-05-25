using System.Net.Http.Json;
using System.Text.Json;
using Dizajno.Dto.Admin;
using Dizajno.Dto.Asset;
using Dizajno.Dto.Auth;
using Dizajno.Dto.Catalog;
using Dizajno.Dto.Project;
using Dizajno.Dto.Quote;
using Dizajno.Dto.Share;
using Dizajno.Dto.Supplier;
using Dizajno.Domain.Entities;
using Dizajno.Domain.Enums;
using Dizajno.Data;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Xunit;

namespace Dizajno.IntegrationTests;

/// <summary>
/// Phase 4: texture data lives in supplier_textures + product_variant_texture_slots,
/// no longer in product_variants.attributes jsonb. The catalog DTO shape is unchanged
/// (frontend keeps treating texture options as Record&lt;slotName, string[]&gt;), and
/// a Postgres trigger blocks attaching a supplier's texture to another supplier's variant.
/// </summary>
public sealed class CustomizerTexturesTests : IClassFixture<DizajnoApiFactory>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    private readonly DizajnoApiFactory _factory;

    public CustomizerTexturesTests(DizajnoApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Catalog_ColorableSectionalSofa_ExposesCorduroyTextureFromRelationalRows()
    {
        var client = _factory.CreateClient();
        var product = await client.GetFromJsonAsync<FurnitureItemDto>(
            "/api/catalog/products/colorable-sectional-sofa", JsonOpts);

        product.Should().NotBeNull();
        product!.TextureSlots.Should().NotBeNull();
        product.TextureSlots!.Should().ContainKey("Body");
        product.TextureSlots!.Should().ContainKey("Pillows");

        product.TextureSlots!["Body"].Should().Equal("", "/textures/corduroy-fabric.jpg");
        product.TextureSlots["Pillows"].Should().Equal("", "/textures/corduroy-fabric.jpg");
    }

    [Fact]
    public async Task Catalog_ProductWithoutTextureSlots_ReturnsNullTextureSlots()
    {
        var client = _factory.CreateClient();
        var product = await client.GetFromJsonAsync<FurnitureItemDto>(
            "/api/catalog/products/chair", JsonOpts);

        product.Should().NotBeNull();
        product!.TextureSlots.Should().BeNull();
    }

    [Fact]
    public async Task Variant_Attributes_NoLongerCarryTextureSlots()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DizajnoDbContext>();

        var attrs = await db.Products
            .Where(p => p.Slug == "colorable-sectional-sofa")
            .SelectMany(p => p.Variants)
            .Select(v => v.Attributes)
            .FirstAsync();

        // Anything other than the empty object would be a regression to the Phase 1 placeholder.
        attrs.Should().NotContain("textureSlots");
    }

    [Fact]
    public async Task Seeder_PopulatesSupplierTextureLibraryAndVariantSlots()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DizajnoDbContext>();

        var dizajnoSupplierId = await db.Suppliers
            .Where(s => s.Slug == "dizajno")
            .Select(s => s.Id)
            .SingleAsync();

        var textures = await db.SupplierTextures
            .Where(t => t.SupplierId == dizajnoSupplierId)
            .Include(t => t.Asset)
            .ToListAsync();
        textures.Should().ContainSingle()
            .Which.Asset.Url.Should().Be("/textures/corduroy-fabric.jpg");

        var corduroyId = textures[0].Id;

        var variantId = await db.Products
            .Where(p => p.Slug == "colorable-sectional-sofa")
            .SelectMany(p => p.Variants)
            .Select(v => v.Id)
            .FirstAsync();

        var slots = await db.ProductVariantTextureSlots
            .Where(s => s.VariantId == variantId)
            .OrderBy(s => s.SlotName)
            .ToListAsync();

        slots.Should().HaveCount(2);
        slots.Select(s => s.SlotName).Should().BeEquivalentTo(new[] { "Body", "Pillows" });
        slots.Should().OnlyContain(s => s.SupplierTextureId == corduroyId);
        slots.Should().OnlyContain(s => s.IsDefault);
    }

    [Fact]
    public async Task Trigger_BlocksCrossSupplierTextureSlot()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DizajnoDbContext>();

        var dizajnoVariantId = await db.Products
            .Where(p => p.Slug == "colorable-sectional-sofa")
            .SelectMany(p => p.Variants)
            .Select(v => v.Id)
            .FirstAsync();

        // Create a foreign supplier with its own texture asset.
        var foreignSupplier = new Supplier
        {
            Id = Guid.NewGuid(),
            Slug = $"foreign-{Guid.NewGuid():N}"[..18],
            Name = "Foreign Supplier"
        };
        var foreignAsset = new Asset
        {
            Id = Guid.NewGuid(),
            OwnerSupplierId = foreignSupplier.Id,
            Kind = AssetKind.Image,
            Url = "/textures/foreign.jpg",
            MimeType = "image/jpeg",
            SizeBytes = 0,
            SortOrder = 0
        };
        var foreignTexture = new SupplierTexture
        {
            Id = Guid.NewGuid(),
            SupplierId = foreignSupplier.Id,
            Name = "Foreign Velvet",
            AssetId = foreignAsset.Id,
            Tags = Array.Empty<string>()
        };
        db.Suppliers.Add(foreignSupplier);
        db.Assets.Add(foreignAsset);
        db.SupplierTextures.Add(foreignTexture);
        await db.SaveChangesAsync();

        // Attaching the foreign texture to a dizajno-owned variant should be blocked
        // by the supplier-match trigger.
        db.ProductVariantTextureSlots.Add(new ProductVariantTextureSlot
        {
            Id = Guid.NewGuid(),
            VariantId = dizajnoVariantId,
            SlotName = "Body",
            SupplierTextureId = foreignTexture.Id,
            IsDefault = false
        });

        var act = async () => await db.SaveChangesAsync();
        var ex = await act.Should().ThrowAsync<DbUpdateException>();
        var pg = ex.WithInnerException<PostgresException>().Which;
        pg.MessageText.Should().Contain("does not match texture supplier");
    }
}
