using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Dizajno.Api.Contracts;
using Dizajno.Domain.Entities;
using Dizajno.Domain.Enums;
using Dizajno.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Dizajno.IntegrationTests;

/// <summary>
/// Phase 7b — supplier portal endpoints. Covers product/variant CRUD + status
/// transitions, texture library + per-variant slot bindings, category
/// suggestions, Owner-only member management with last-Owner protection,
/// Owner-only profile edits, and the gating cross-cuts (Staff can't manage
/// members, foreign suppliers 403, suspended suppliers 403).
/// </summary>
public sealed class SupplierPortalTests : IClassFixture<DizajnoApiFactory>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web)
    {
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() }
    };

    private readonly DizajnoApiFactory _factory;

    public SupplierPortalTests(DizajnoApiFactory factory) => _factory = factory;

    private HttpClient NewClient() => _factory.CreateClient();

    private async Task<HttpClient> NewAdminClientAsync()
    {
        var client = NewClient();
        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(
            Email: "admin@test.local", Password: "Admin1234!"));
        response.EnsureSuccessStatusCode();
        var auth = (await response.Content.ReadFromJsonAsync<AuthResponse>(JsonOpts))!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return client;
    }

    private async Task<(HttpClient client, AuthResponse auth)> NewUserClientAsync(string suffix)
    {
        var client = NewClient();
        var response = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(
            Email: $"phase7b-{suffix}@dizajno.test",
            Password: "Passw0rd!",
            DisplayName: $"User {suffix}",
            Locale: "sq"));
        response.EnsureSuccessStatusCode();
        var auth = (await response.Content.ReadFromJsonAsync<AuthResponse>(JsonOpts))!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return (client, auth);
    }

    /// <summary>
    /// Creates a supplier directly in the DB and binds the supplied user as
    /// the requested role. Saves a round-trip through the admin endpoints in
    /// every test setup.
    /// </summary>
    private async Task<Guid> SeedSupplierWithMemberAsync(
        string slugPrefix, Guid userId, SupplierMemberRole role, bool trusted = false)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DizajnoDbContext>();
        var supplier = new Supplier
        {
            Id = Guid.NewGuid(),
            Slug = $"{slugPrefix}-{Guid.NewGuid():N}"[..18].ToLowerInvariant(),
            Name = $"{slugPrefix} Co.",
            IsTrusted = trusted,
            CreatedAt = DateTime.UtcNow
        };
        db.Suppliers.Add(supplier);
        db.SupplierMembers.Add(new SupplierMember
        {
            Id = Guid.NewGuid(),
            SupplierId = supplier.Id,
            UserId = userId,
            Role = role,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        return supplier.Id;
    }

    private async Task<Guid> GetSeedFurnitureCategoryIdAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DizajnoDbContext>();
        return await db.Categories
            .Where(c => c.Family == ProductFamily.Furniture && c.Status == CategoryStatus.Approved)
            .Select(c => c.Id)
            .FirstAsync();
    }

    private static CreateProductRequest BuildProductRequest(Guid supplierId, Guid categoryId, string? slug = null) => new(
        SupplierId: supplierId,
        Family: ProductFamily.Furniture,
        CategoryId: categoryId,
        Slug: slug ?? $"phase7b-prod-{Guid.NewGuid():N}"[..22],
        Name: "Phase 7b Sofa",
        Description: "Test product",
        UnitOfSale: UnitOfSale.Piece,
        CoverageRate: null,
        WasteFactor: 0,
        LeadTimeDays: 14,
        PreviewSvg: null,
        TextureUrl: null,
        Attributes: null);

    private static CreateVariantRequest BuildVariantRequest(string? sku = null) => new(
        Sku: sku ?? $"PH7B-{Guid.NewGuid():N}"[..14].ToUpperInvariant(),
        Name: "Standard",
        Width: 1.8m, Depth: 0.9m, Height: 0.85m,
        Color: "#666666",
        BasePrice: 499m,
        Currency: "EUR",
        CollisionBoxes: null,
        MaterialDefaults: null,
        Attributes: null,
        SortOrder: null);

    // ── Products: CRUD + status transitions ───────────────────────────────

    [Fact]
    public async Task Products_Create_StartsAsDraft()
    {
        var (client, auth) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var supplierId = await SeedSupplierWithMemberAsync("draft", auth.User.Id, SupplierMemberRole.Owner);
        var categoryId = await GetSeedFurnitureCategoryIdAsync();

        var response = await client.PostAsJsonAsync(
            "/api/supplier/products", BuildProductRequest(supplierId, categoryId), JsonOpts);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var dto = (await response.Content.ReadFromJsonAsync<SupplierProductDetailDto>(JsonOpts))!;
        dto.Status.Should().Be(ProductStatus.Draft);
        dto.SupplierId.Should().Be(supplierId);
    }

    [Fact]
    public async Task Products_Create_ForeignSupplier_ReturnsForbidden()
    {
        var (clientA, authA) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var (_, authB) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        // Caller A is not a member of supplier B.
        var supplierB = await SeedSupplierWithMemberAsync("foreign", authB.User.Id, SupplierMemberRole.Owner);
        var categoryId = await GetSeedFurnitureCategoryIdAsync();

        var response = await clientA.PostAsJsonAsync(
            "/api/supplier/products", BuildProductRequest(supplierB, categoryId), JsonOpts);
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Products_Create_DuplicateSlug_Returns409()
    {
        var (client, auth) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var supplierId = await SeedSupplierWithMemberAsync("dup", auth.User.Id, SupplierMemberRole.Owner);
        var categoryId = await GetSeedFurnitureCategoryIdAsync();
        var slug = $"dup-slug-{Guid.NewGuid():N}"[..20];

        var first = await client.PostAsJsonAsync(
            "/api/supplier/products", BuildProductRequest(supplierId, categoryId, slug), JsonOpts);
        first.EnsureSuccessStatusCode();
        var second = await client.PostAsJsonAsync(
            "/api/supplier/products", BuildProductRequest(supplierId, categoryId, slug), JsonOpts);
        second.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Products_PublishWithoutVariants_Returns409()
    {
        var (client, auth) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var supplierId = await SeedSupplierWithMemberAsync("novar", auth.User.Id, SupplierMemberRole.Owner);
        var categoryId = await GetSeedFurnitureCategoryIdAsync();

        var create = await client.PostAsJsonAsync(
            "/api/supplier/products", BuildProductRequest(supplierId, categoryId), JsonOpts);
        var product = (await create.Content.ReadFromJsonAsync<SupplierProductDetailDto>(JsonOpts))!;

        var publish = await client.PostAsync($"/api/supplier/products/{product.Id}/publish", null);
        publish.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Products_Publish_TrustedSupplier_GoesStraightToPublished()
    {
        var (client, auth) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var supplierId = await SeedSupplierWithMemberAsync("trusted", auth.User.Id, SupplierMemberRole.Owner, trusted: true);
        var categoryId = await GetSeedFurnitureCategoryIdAsync();

        var create = await client.PostAsJsonAsync(
            "/api/supplier/products", BuildProductRequest(supplierId, categoryId), JsonOpts);
        var product = (await create.Content.ReadFromJsonAsync<SupplierProductDetailDto>(JsonOpts))!;
        var addVariant = await client.PostAsJsonAsync(
            $"/api/supplier/products/{product.Id}/variants", BuildVariantRequest(), JsonOpts);
        addVariant.EnsureSuccessStatusCode();

        var publish = await client.PostAsync($"/api/supplier/products/{product.Id}/publish", null);
        publish.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var detail = await client.GetFromJsonAsync<SupplierProductDetailDto>(
            $"/api/supplier/products/{product.Id}", JsonOpts);
        detail!.Status.Should().Be(ProductStatus.Published);
    }

    [Fact]
    public async Task Products_Publish_UntrustedSupplier_GoesToPending()
    {
        var (client, auth) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var supplierId = await SeedSupplierWithMemberAsync("untrusted", auth.User.Id, SupplierMemberRole.Owner, trusted: false);
        var categoryId = await GetSeedFurnitureCategoryIdAsync();

        var create = await client.PostAsJsonAsync(
            "/api/supplier/products", BuildProductRequest(supplierId, categoryId), JsonOpts);
        var product = (await create.Content.ReadFromJsonAsync<SupplierProductDetailDto>(JsonOpts))!;
        var addVariant = await client.PostAsJsonAsync(
            $"/api/supplier/products/{product.Id}/variants", BuildVariantRequest(), JsonOpts);
        addVariant.EnsureSuccessStatusCode();

        await client.PostAsync($"/api/supplier/products/{product.Id}/publish", null);

        var detail = await client.GetFromJsonAsync<SupplierProductDetailDto>(
            $"/api/supplier/products/{product.Id}", JsonOpts);
        detail!.Status.Should().Be(ProductStatus.Pending);

        // Pending product appears in the admin moderation queue.
        var admin = await NewAdminClientAsync();
        var queue = await admin.GetFromJsonAsync<List<PendingProductDto>>(
            "/api/admin/moderation/products", JsonOpts);
        queue!.Should().Contain(p => p.Id == product.Id);
    }

    [Fact]
    public async Task Products_HidePublished_NeverReTriggersPendingOnRePublish()
    {
        var (client, auth) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var supplierId = await SeedSupplierWithMemberAsync("rehide", auth.User.Id, SupplierMemberRole.Owner, trusted: true);
        var categoryId = await GetSeedFurnitureCategoryIdAsync();

        var create = await client.PostAsJsonAsync(
            "/api/supplier/products", BuildProductRequest(supplierId, categoryId), JsonOpts);
        var product = (await create.Content.ReadFromJsonAsync<SupplierProductDetailDto>(JsonOpts))!;
        await client.PostAsJsonAsync(
            $"/api/supplier/products/{product.Id}/variants", BuildVariantRequest(), JsonOpts);
        await client.PostAsync($"/api/supplier/products/{product.Id}/publish", null);

        await client.PostAsync($"/api/supplier/products/{product.Id}/hide", null);
        var hidden = await client.GetFromJsonAsync<SupplierProductDetailDto>(
            $"/api/supplier/products/{product.Id}", JsonOpts);
        hidden!.Status.Should().Be(ProductStatus.Hidden);

        // Re-publish should NOT re-enter Pending — already moderated once even
        // though the supplier is now untrusted.
        await UntrustSupplierAsync(supplierId);
        await client.PostAsync($"/api/supplier/products/{product.Id}/publish", null);
        var rePublished = await client.GetFromJsonAsync<SupplierProductDetailDto>(
            $"/api/supplier/products/{product.Id}", JsonOpts);
        rePublished!.Status.Should().Be(ProductStatus.Published);
    }

    [Fact]
    public async Task Products_Remove_Terminal()
    {
        var (client, auth) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var supplierId = await SeedSupplierWithMemberAsync("rmv", auth.User.Id, SupplierMemberRole.Owner);
        var categoryId = await GetSeedFurnitureCategoryIdAsync();

        var create = await client.PostAsJsonAsync(
            "/api/supplier/products", BuildProductRequest(supplierId, categoryId), JsonOpts);
        var product = (await create.Content.ReadFromJsonAsync<SupplierProductDetailDto>(JsonOpts))!;

        var remove = await client.PostAsync($"/api/supplier/products/{product.Id}/remove", null);
        remove.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Subsequent updates fail (terminal state).
        var update = await client.PutAsJsonAsync(
            $"/api/supplier/products/{product.Id}",
            new UpdateProductRequest(categoryId, "Updated", null, UnitOfSale.Piece, null, 0, null, null, null, null),
            JsonOpts);
        update.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Products_SuspendedSupplier_BlocksAccess()
    {
        var (client, auth) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var supplierId = await SeedSupplierWithMemberAsync("susp", auth.User.Id, SupplierMemberRole.Owner);
        var categoryId = await GetSeedFurnitureCategoryIdAsync();

        // Suspend it.
        var admin = await NewAdminClientAsync();
        (await admin.PostAsync($"/api/admin/suppliers/{supplierId}/suspend", null)).EnsureSuccessStatusCode();

        var response = await client.PostAsJsonAsync(
            "/api/supplier/products", BuildProductRequest(supplierId, categoryId), JsonOpts);
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── Variants ──────────────────────────────────────────────────────────

    [Fact]
    public async Task Variants_Create_AndList_AppearsOnProductDetail()
    {
        var (client, auth) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var supplierId = await SeedSupplierWithMemberAsync("var", auth.User.Id, SupplierMemberRole.Owner);
        var categoryId = await GetSeedFurnitureCategoryIdAsync();

        var create = await client.PostAsJsonAsync(
            "/api/supplier/products", BuildProductRequest(supplierId, categoryId), JsonOpts);
        var product = (await create.Content.ReadFromJsonAsync<SupplierProductDetailDto>(JsonOpts))!;

        var addVariant = await client.PostAsJsonAsync(
            $"/api/supplier/products/{product.Id}/variants", BuildVariantRequest("SKU-1"), JsonOpts);
        addVariant.StatusCode.Should().Be(HttpStatusCode.Created);

        var detail = await client.GetFromJsonAsync<SupplierProductDetailDto>(
            $"/api/supplier/products/{product.Id}", JsonOpts);
        detail!.Variants.Should().HaveCount(1);
        detail.Variants[0].Sku.Should().Be("SKU-1");
    }

    [Fact]
    public async Task Variants_AttachGlb_RejectsCrossSupplierAsset()
    {
        var (clientA, authA) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var supplierA = await SeedSupplierWithMemberAsync("attA", authA.User.Id, SupplierMemberRole.Owner);
        var (_, authB) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var supplierB = await SeedSupplierWithMemberAsync("attB", authB.User.Id, SupplierMemberRole.Owner);
        var categoryId = await GetSeedFurnitureCategoryIdAsync();

        // Create product+variant under A; create an asset owned by B.
        var create = await clientA.PostAsJsonAsync(
            "/api/supplier/products", BuildProductRequest(supplierA, categoryId), JsonOpts);
        var productA = (await create.Content.ReadFromJsonAsync<SupplierProductDetailDto>(JsonOpts))!;
        var addVariant = await clientA.PostAsJsonAsync(
            $"/api/supplier/products/{productA.Id}/variants", BuildVariantRequest(), JsonOpts);
        var variant = (await addVariant.Content.ReadFromJsonAsync<SupplierVariantDto>(JsonOpts))!;

        Guid foreignAssetId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<DizajnoDbContext>();
            var asset = new Asset
            {
                Id = Guid.NewGuid(),
                OwnerSupplierId = supplierB,
                Kind = AssetKind.Glb,
                Url = "https://assets.test.local/foreign.glb",
                MimeType = "model/gltf-binary",
                SizeBytes = 100,
                CreatedAt = DateTime.UtcNow
            };
            db.Assets.Add(asset);
            await db.SaveChangesAsync();
            foreignAssetId = asset.Id;
        }

        var attach = await clientA.PostAsJsonAsync(
            $"/api/supplier/variants/{variant.Id}/attach-glb",
            new AttachVariantAssetRequest(foreignAssetId), JsonOpts);
        attach.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Variants_Delete_RejectsWhenReferencedByScene()
    {
        var (client, auth) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var supplierId = await SeedSupplierWithMemberAsync("vdel", auth.User.Id, SupplierMemberRole.Owner);
        var categoryId = await GetSeedFurnitureCategoryIdAsync();

        var create = await client.PostAsJsonAsync(
            "/api/supplier/products", BuildProductRequest(supplierId, categoryId), JsonOpts);
        var product = (await create.Content.ReadFromJsonAsync<SupplierProductDetailDto>(JsonOpts))!;
        var addVariant = await client.PostAsJsonAsync(
            $"/api/supplier/products/{product.Id}/variants", BuildVariantRequest(), JsonOpts);
        var variant = (await addVariant.Content.ReadFromJsonAsync<SupplierVariantDto>(JsonOpts))!;

        // Plant a PlacedItem referencing it.
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<DizajnoDbContext>();
            var project = new Project
            {
                Id = Guid.NewGuid(),
                OwnerUserId = auth.User.Id,
                Name = "Phantom",
                CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
            };
            db.Projects.Add(project);
            db.PlacedItems.Add(new PlacedItem
            {
                Id = Guid.NewGuid(),
                ProjectId = project.Id,
                ProductVariantId = variant.Id,
                PositionX = 0, PositionZ = 0,
                Rotation = 0, Scale = 1,
                ScaledWidth = 1, ScaledDepth = 1, ScaledHeight = 1,
                CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        var del = await client.DeleteAsync($"/api/supplier/variants/{variant.Id}");
        del.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    // ── Textures ──────────────────────────────────────────────────────────

    [Fact]
    public async Task Textures_Create_AndDelete_Lifecycle()
    {
        var (client, auth) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var supplierId = await SeedSupplierWithMemberAsync("tex", auth.User.Id, SupplierMemberRole.Owner);

        Guid assetId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<DizajnoDbContext>();
            var a = new Asset
            {
                Id = Guid.NewGuid(),
                OwnerSupplierId = supplierId,
                Kind = AssetKind.Image,
                Url = "https://assets.test.local/wood.jpg",
                MimeType = "image/jpeg",
                SizeBytes = 1000,
                CreatedAt = DateTime.UtcNow
            };
            db.Assets.Add(a);
            await db.SaveChangesAsync();
            assetId = a.Id;
        }

        var create = await client.PostAsJsonAsync(
            "/api/supplier/textures",
            new CreateTextureRequest(supplierId, "Walnut", assetId, null,
                new[] { "wood", "dark" }, 6, 6),
            JsonOpts);
        create.StatusCode.Should().Be(HttpStatusCode.Created);
        var texture = (await create.Content.ReadFromJsonAsync<SupplierTextureDto>(JsonOpts))!;
        texture.Tags.Should().BeEquivalentTo(new[] { "wood", "dark" });

        var delete = await client.DeleteAsync($"/api/supplier/textures/{texture.Id}");
        delete.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Textures_VariantSlotBinding_RejectsCrossSupplierTexture()
    {
        var (clientA, authA) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var supplierA = await SeedSupplierWithMemberAsync("tslotA", authA.User.Id, SupplierMemberRole.Owner);
        var (_, authB) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var supplierB = await SeedSupplierWithMemberAsync("tslotB", authB.User.Id, SupplierMemberRole.Owner);
        var categoryId = await GetSeedFurnitureCategoryIdAsync();

        // Product + variant under supplier A.
        var create = await clientA.PostAsJsonAsync(
            "/api/supplier/products", BuildProductRequest(supplierA, categoryId), JsonOpts);
        var productA = (await create.Content.ReadFromJsonAsync<SupplierProductDetailDto>(JsonOpts))!;
        var addVariant = await clientA.PostAsJsonAsync(
            $"/api/supplier/products/{productA.Id}/variants", BuildVariantRequest(), JsonOpts);
        var variant = (await addVariant.Content.ReadFromJsonAsync<SupplierVariantDto>(JsonOpts))!;

        // Texture owned by supplier B.
        Guid foreignTextureId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<DizajnoDbContext>();
            var asset = new Asset
            {
                Id = Guid.NewGuid(),
                OwnerSupplierId = supplierB,
                Kind = AssetKind.Image,
                Url = "https://assets.test.local/b.jpg",
                MimeType = "image/jpeg",
                SizeBytes = 100,
                CreatedAt = DateTime.UtcNow
            };
            db.Assets.Add(asset);
            var t = new SupplierTexture
            {
                Id = Guid.NewGuid(),
                SupplierId = supplierB,
                Name = "Foreign",
                AssetId = asset.Id,
                Tags = Array.Empty<string>(),
                RepeatU = 4, RepeatV = 4,
                CreatedAt = DateTime.UtcNow
            };
            db.SupplierTextures.Add(t);
            await db.SaveChangesAsync();
            foreignTextureId = t.Id;
        }

        var assign = await clientA.PutAsJsonAsync(
            $"/api/supplier/variants/{variant.Id}/texture-slots",
            new ReplaceVariantTextureSlotsRequest(new[]
            {
                new VariantTextureSlotInput("Body", foreignTextureId, true)
            }),
            JsonOpts);
        assign.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Textures_VariantSlotBinding_ReplacesExistingRows()
    {
        var (client, auth) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var supplierId = await SeedSupplierWithMemberAsync("tslot", auth.User.Id, SupplierMemberRole.Owner);
        var categoryId = await GetSeedFurnitureCategoryIdAsync();

        var create = await client.PostAsJsonAsync(
            "/api/supplier/products", BuildProductRequest(supplierId, categoryId), JsonOpts);
        var product = (await create.Content.ReadFromJsonAsync<SupplierProductDetailDto>(JsonOpts))!;
        var addVariant = await client.PostAsJsonAsync(
            $"/api/supplier/products/{product.Id}/variants", BuildVariantRequest(), JsonOpts);
        var variant = (await addVariant.Content.ReadFromJsonAsync<SupplierVariantDto>(JsonOpts))!;

        // Two textures under our supplier.
        var (assetId1, assetId2) = (Guid.NewGuid(), Guid.NewGuid());
        Guid t1Id, t2Id;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<DizajnoDbContext>();
            db.Assets.AddRange(
                new Asset { Id = assetId1, OwnerSupplierId = supplierId, Kind = AssetKind.Image, Url = "https://a/1.jpg", MimeType = "image/jpeg", SizeBytes = 1, CreatedAt = DateTime.UtcNow },
                new Asset { Id = assetId2, OwnerSupplierId = supplierId, Kind = AssetKind.Image, Url = "https://a/2.jpg", MimeType = "image/jpeg", SizeBytes = 1, CreatedAt = DateTime.UtcNow });
            var t1 = new SupplierTexture { Id = Guid.NewGuid(), SupplierId = supplierId, Name = "Linen", AssetId = assetId1, Tags = Array.Empty<string>(), RepeatU = 4, RepeatV = 4, CreatedAt = DateTime.UtcNow };
            var t2 = new SupplierTexture { Id = Guid.NewGuid(), SupplierId = supplierId, Name = "Velvet", AssetId = assetId2, Tags = Array.Empty<string>(), RepeatU = 4, RepeatV = 4, CreatedAt = DateTime.UtcNow };
            db.SupplierTextures.AddRange(t1, t2);
            await db.SaveChangesAsync();
            t1Id = t1.Id; t2Id = t2.Id;
        }

        // First assignment: Body=Linen+default, Body=Velvet.
        await client.PutAsJsonAsync(
            $"/api/supplier/variants/{variant.Id}/texture-slots",
            new ReplaceVariantTextureSlotsRequest(new[]
            {
                new VariantTextureSlotInput("Body", t1Id, true),
                new VariantTextureSlotInput("Body", t2Id, false)
            }),
            JsonOpts);

        // Second assignment fully replaces — only Velvet on Pillows.
        await client.PutAsJsonAsync(
            $"/api/supplier/variants/{variant.Id}/texture-slots",
            new ReplaceVariantTextureSlotsRequest(new[]
            {
                new VariantTextureSlotInput("Pillows", t2Id, true)
            }),
            JsonOpts);

        var slots = await client.GetFromJsonAsync<List<VariantTextureSlotDto>>(
            $"/api/supplier/variants/{variant.Id}/texture-slots", JsonOpts);
        slots!.Should().HaveCount(1);
        slots![0].SlotName.Should().Be("Pillows");
        slots![0].SupplierTextureId.Should().Be(t2Id);
        slots![0].IsDefault.Should().BeTrue();
    }

    // ── Categories: suggest ──────────────────────────────────────────────

    [Fact]
    public async Task Categories_Suggest_LandsInPendingForAdminQueue()
    {
        var (client, auth) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var supplierId = await SeedSupplierWithMemberAsync("cats", auth.User.Id, SupplierMemberRole.Owner);

        var response = await client.PostAsJsonAsync(
            "/api/supplier/categories",
            new SuggestCategoryRequest(supplierId, ProductFamily.Lighting, null, "Pendant Lights"),
            JsonOpts);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var dto = (await response.Content.ReadFromJsonAsync<SuggestedCategoryDto>(JsonOpts))!;
        dto.Status.Should().Be(CategoryStatus.Pending);
        dto.SuggestedBySupplierId.Should().Be(supplierId);
        dto.Slug.Should().Be("pendant-lights");

        var admin = await NewAdminClientAsync();
        var queue = await admin.GetFromJsonAsync<List<PendingCategoryDto>>(
            "/api/admin/moderation/categories", JsonOpts);
        queue!.Should().Contain(c => c.Id == dto.Id);
    }

    // ── Members: last-Owner protection ───────────────────────────────────

    [Fact]
    public async Task Members_CannotDemoteLastOwner()
    {
        var (client, auth) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var supplierId = await SeedSupplierWithMemberAsync("lastown", auth.User.Id, SupplierMemberRole.Owner);

        // Find the membership row.
        Guid memberId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<DizajnoDbContext>();
            memberId = await db.SupplierMembers
                .Where(m => m.SupplierId == supplierId && m.UserId == auth.User.Id)
                .Select(m => m.Id).SingleAsync();
        }

        var demote = await client.PutAsJsonAsync(
            $"/api/supplier/members/{memberId}/role",
            new ChangeMemberRoleRequest(SupplierMemberRole.Staff),
            JsonOpts);
        demote.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Members_CannotRemoveLastOwner()
    {
        var (client, auth) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var supplierId = await SeedSupplierWithMemberAsync("rmlast", auth.User.Id, SupplierMemberRole.Owner);

        Guid memberId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<DizajnoDbContext>();
            memberId = await db.SupplierMembers
                .Where(m => m.SupplierId == supplierId && m.UserId == auth.User.Id)
                .Select(m => m.Id).SingleAsync();
        }

        var remove = await client.DeleteAsync($"/api/supplier/members/{memberId}");
        remove.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Members_StaffCannotChangeRoles()
    {
        var (ownerClient, ownerAuth) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var (staffClient, staffAuth) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var supplierId = await SeedSupplierWithMemberAsync("staffmod", ownerAuth.User.Id, SupplierMemberRole.Owner);

        // Bind staff member directly.
        Guid staffMemberId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<DizajnoDbContext>();
            var member = new SupplierMember
            {
                Id = Guid.NewGuid(),
                SupplierId = supplierId,
                UserId = staffAuth.User.Id,
                Role = SupplierMemberRole.Staff,
                CreatedAt = DateTime.UtcNow
            };
            db.SupplierMembers.Add(member);
            await db.SaveChangesAsync();
            staffMemberId = member.Id;
        }

        // Staff tries to promote themselves to Owner → 403.
        var attempt = await staffClient.PutAsJsonAsync(
            $"/api/supplier/members/{staffMemberId}/role",
            new ChangeMemberRoleRequest(SupplierMemberRole.Owner),
            JsonOpts);
        attempt.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        // Owner can do it.
        var promote = await ownerClient.PutAsJsonAsync(
            $"/api/supplier/members/{staffMemberId}/role",
            new ChangeMemberRoleRequest(SupplierMemberRole.Owner),
            JsonOpts);
        promote.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    // ── Profile (Owner-only) ─────────────────────────────────────────────

    [Fact]
    public async Task Profile_OwnerCanEdit_StaffCannot()
    {
        var (ownerClient, ownerAuth) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var supplierId = await SeedSupplierWithMemberAsync("profile", ownerAuth.User.Id, SupplierMemberRole.Owner);

        var (staffClient, staffAuth) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<DizajnoDbContext>();
            db.SupplierMembers.Add(new SupplierMember
            {
                Id = Guid.NewGuid(),
                SupplierId = supplierId,
                UserId = staffAuth.User.Id,
                Role = SupplierMemberRole.Staff,
                CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        // Staff can GET the profile…
        var staffGet = await staffClient.GetAsync($"/api/supplier/profile/{supplierId}");
        staffGet.StatusCode.Should().Be(HttpStatusCode.OK);
        // …but cannot PUT.
        var staffPut = await staffClient.PutAsJsonAsync(
            $"/api/supplier/profile/{supplierId}",
            new UpdateProfileRequest("Hacked", null, null, null, null, null),
            JsonOpts);
        staffPut.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        var ownerPut = await ownerClient.PutAsJsonAsync(
            $"/api/supplier/profile/{supplierId}",
            new UpdateProfileRequest("Acme Renamed", "Updated", "https://acme.example", "ops@acme.example", "+355 555", null),
            JsonOpts);
        ownerPut.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = (await ownerPut.Content.ReadFromJsonAsync<SupplierProfileDto>(JsonOpts))!;
        dto.Name.Should().Be("Acme Renamed");
    }

    // ── Owner-side invites (Phase 7c) ─────────────────────────────────────

    [Fact]
    public async Task Invites_OwnerCanIssueLink_StaffCannot()
    {
        var (ownerClient, ownerAuth) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var (staffClient, staffAuth) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var supplierId = await SeedSupplierWithMemberAsync("ownerinv", ownerAuth.User.Id, SupplierMemberRole.Owner);
        // Bind staff.
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<DizajnoDbContext>();
            db.SupplierMembers.Add(new SupplierMember
            {
                Id = Guid.NewGuid(),
                SupplierId = supplierId,
                UserId = staffAuth.User.Id,
                Role = SupplierMemberRole.Staff,
                CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        // Staff cannot issue invites.
        var staffAttempt = await staffClient.PostAsJsonAsync("/api/supplier/invites",
            new CreateSupplierInviteRequest(supplierId, "newhire@example.com", SupplierMemberRole.Staff, null),
            JsonOpts);
        staffAttempt.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        // Owner can.
        var ownerIssue = await ownerClient.PostAsJsonAsync("/api/supplier/invites",
            new CreateSupplierInviteRequest(supplierId, "newhire@example.com", SupplierMemberRole.Staff, 7),
            JsonOpts);
        ownerIssue.StatusCode.Should().Be(HttpStatusCode.Created);
        var dto = (await ownerIssue.Content.ReadFromJsonAsync<SupplierInviteDto>(JsonOpts))!;
        dto.Token.Should().NotBeNullOrWhiteSpace();
        dto.AcceptUrl.Should().Contain(dto.Token!);

        // List returns the row but not the plaintext token.
        var list = await ownerClient.GetFromJsonAsync<List<SupplierInviteDto>>(
            $"/api/supplier/invites?supplierId={supplierId}", JsonOpts);
        list!.Should().HaveCount(1);
        list![0].Token.Should().BeNull();
    }

    [Fact]
    public async Task Invites_ForeignSupplier_Returns403()
    {
        var (ownerClient, ownerAuth) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        await SeedSupplierWithMemberAsync("ownA", ownerAuth.User.Id, SupplierMemberRole.Owner);
        var (_, authB) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var supplierB = await SeedSupplierWithMemberAsync("ownB", authB.User.Id, SupplierMemberRole.Owner);

        // ownerClient is an Owner of A, not B.
        var attempt = await ownerClient.PostAsJsonAsync("/api/supplier/invites",
            new CreateSupplierInviteRequest(supplierB, "x@example.com", SupplierMemberRole.Staff, null),
            JsonOpts);
        attempt.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── Asset uploads accept GLB + SVG kinds ─────────────────────────────

    [Fact]
    public async Task Assets_SupplierPresign_AcceptsGlbAndSvgPreviewKinds()
    {
        var (client, auth) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var supplierId = await SeedSupplierWithMemberAsync("assetkind", auth.User.Id, SupplierMemberRole.Owner);

        var glb = await client.PostAsJsonAsync("/api/supplier/assets/presign", new PresignSupplierAssetRequest(
            SupplierId: supplierId,
            Kind: AssetKind.Glb,
            ContentType: "model/gltf-binary",
            SizeBytes: 5_000_000,
            ChecksumSha256: null,
            OriginalFileName: "model.glb"));
        glb.StatusCode.Should().Be(HttpStatusCode.OK);

        var svg = await client.PostAsJsonAsync("/api/supplier/assets/presign", new PresignSupplierAssetRequest(
            SupplierId: supplierId,
            Kind: AssetKind.SvgPreview,
            ContentType: "image/svg+xml",
            SizeBytes: 50_000,
            ChecksumSha256: null,
            OriginalFileName: "preview.svg"));
        svg.StatusCode.Should().Be(HttpStatusCode.OK);

        var cad = await client.PostAsJsonAsync("/api/supplier/assets/presign", new PresignSupplierAssetRequest(
            SupplierId: supplierId,
            Kind: AssetKind.CadSource,
            ContentType: "application/octet-stream",
            SizeBytes: 50_000,
            ChecksumSha256: null,
            OriginalFileName: "drawing.dwg"));
        cad.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    private async Task UntrustSupplierAsync(Guid supplierId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DizajnoDbContext>();
        var s = await db.Suppliers.FirstAsync(x => x.Id == supplierId);
        s.IsTrusted = false;
        await db.SaveChangesAsync();
    }
}
