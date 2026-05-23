using System.Text.Json;
using Dizajno.Api.Contracts;
using Dizajno.Domain.Entities;
using Dizajno.Domain.Enums;
using Dizajno.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dizajno.Api.Controllers;

[ApiController]
[Route("api/catalog")]
public sealed class CatalogController : ControllerBase
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly DizajnoDbContext _db;

    public CatalogController(DizajnoDbContext db) => _db = db;

    [HttpGet("products")]
    public async Task<ActionResult<IReadOnlyList<FurnitureItemDto>>> GetProducts(
        CancellationToken cancellationToken,
        [FromQuery] string? family = null,
        [FromQuery] string? category = null)
    {
        var query = BuildPublishedProductQuery();

        if (!string.IsNullOrWhiteSpace(family) &&
            Enum.TryParse<ProductFamily>(family, ignoreCase: true, out var parsedFamily))
        {
            query = query.Where(p => p.Family == parsedFamily);
        }

        if (!string.IsNullOrWhiteSpace(category))
        {
            var slug = category.Trim().ToLowerInvariant();
            query = query.Where(p => p.Category.Slug == slug);
        }

        var rows = await query
            .Select(p => new ProjectionRow
            {
                Product = p,
                Category = p.Category,
                Supplier = p.Supplier,
                Variant = p.Variants.OrderBy(v => v.SortOrder).First(),
                GlbAssetUrl = p.Variants
                    .OrderBy(v => v.SortOrder)
                    .Select(v => v.GlbAsset!.Url)
                    .FirstOrDefault()
            })
            .ToListAsync(cancellationToken);

        var textureSlots = await LoadTextureSlotsAsync(
            rows.Select(r => r.Variant.Id).ToList(),
            cancellationToken);

        var items = rows.Select(row => ToDto(row, textureSlots)).ToList();
        return Ok(items);
    }

    [HttpGet("products/{slug}")]
    public async Task<ActionResult<FurnitureItemDto>> GetProduct(
        string slug,
        CancellationToken cancellationToken)
    {
        var row = await BuildPublishedProductQuery()
            .Where(p => p.Slug == slug)
            .Select(p => new ProjectionRow
            {
                Product = p,
                Category = p.Category,
                Supplier = p.Supplier,
                Variant = p.Variants.OrderBy(v => v.SortOrder).First(),
                GlbAssetUrl = p.Variants
                    .OrderBy(v => v.SortOrder)
                    .Select(v => v.GlbAsset!.Url)
                    .FirstOrDefault()
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (row is null)
        {
            return NotFound();
        }

        var textureSlots = await LoadTextureSlotsAsync(
            new List<Guid> { row.Variant.Id },
            cancellationToken);

        return Ok(ToDto(row, textureSlots));
    }

    [HttpGet("categories")]
    public async Task<ActionResult<IReadOnlyList<CategoryDto>>> GetCategories(
        CancellationToken cancellationToken,
        [FromQuery] string? family = null)
    {
        var query = _db.Categories
            .AsQueryable()
            .Where(c => c.Status == CategoryStatus.Approved);

        if (!string.IsNullOrWhiteSpace(family) &&
            Enum.TryParse<ProductFamily>(family, ignoreCase: true, out var parsedFamily))
        {
            query = query.Where(c => c.Family == parsedFamily);
        }

        var list = await query
            .OrderBy(c => c.Family)
            .ThenBy(c => c.SortOrder)
            .ThenBy(c => c.Name)
            .Select(c => new CategoryDto(c.Slug, c.Name, c.Family.ToString()))
            .ToListAsync(cancellationToken);
        return Ok(list);
    }

    [HttpGet("suppliers")]
    public async Task<ActionResult<IReadOnlyList<SupplierDto>>> GetSuppliers(
        CancellationToken cancellationToken)
    {
        var list = await _db.Suppliers
            .Where(s => s.SuspendedAt == null)
            .OrderBy(s => s.Name)
            .Select(s => new SupplierDto(s.Slug, s.Name, s.LogoAsset!.Url))
            .ToListAsync(cancellationToken);
        return Ok(list);
    }

    // Public catalog hides products whose supplier is suspended and whose
    // category isn't approved (admin suspended/unmoderated rows shouldn't
    // surface in the designer or anywhere else outside the admin tooling).
    private IQueryable<Product> BuildPublishedProductQuery() =>
        _db.Products
            .AsNoTracking()
            .Where(p => p.Status == ProductStatus.Published)
            .Where(p => p.Supplier.SuspendedAt == null)
            .Where(p => p.Category.Status == CategoryStatus.Approved);

    /// <summary>
    /// Fetches every <see cref="Domain.Entities.ProductVariantTextureSlot"/> row for
    /// the supplied variant ids, joined to its <see cref="Domain.Entities.SupplierTexture"/>
    /// and <see cref="Domain.Entities.Asset"/>, and groups them by variant + slot.
    /// The resulting list for each slot prepends "" so the frontend's "None" option
    /// stays intact, then orders the remaining urls by IsDefault DESC, Name.
    /// </summary>
    private async Task<Dictionary<Guid, IReadOnlyDictionary<string, IReadOnlyList<string>>>> LoadTextureSlotsAsync(
        IReadOnlyCollection<Guid> variantIds,
        CancellationToken cancellationToken)
    {
        var result = new Dictionary<Guid, IReadOnlyDictionary<string, IReadOnlyList<string>>>();
        if (variantIds.Count == 0)
        {
            return result;
        }

        var slotRows = await _db.ProductVariantTextureSlots
            .AsNoTracking()
            .Where(s => variantIds.Contains(s.VariantId))
            .Select(s => new
            {
                s.VariantId,
                s.SlotName,
                s.IsDefault,
                Name = s.SupplierTexture.Name,
                Url = s.SupplierTexture.Asset.Url
            })
            .ToListAsync(cancellationToken);

        foreach (var byVariant in slotRows.GroupBy(s => s.VariantId))
        {
            var bySlot = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal);
            foreach (var bySlotGroup in byVariant.GroupBy(s => s.SlotName))
            {
                var urls = new List<string> { "" };
                urls.AddRange(bySlotGroup
                    .OrderByDescending(s => s.IsDefault)
                    .ThenBy(s => s.Name, StringComparer.Ordinal)
                    .Select(s => s.Url));
                bySlot[bySlotGroup.Key] = urls;
            }
            result[byVariant.Key] = bySlot;
        }

        return result;
    }

    private static FurnitureItemDto ToDto(
        ProjectionRow row,
        IReadOnlyDictionary<Guid, IReadOnlyDictionary<string, IReadOnlyList<string>>> textureSlotsByVariant)
    {
        var icon = ReadAttribute<string>(row.Product.Attributes, "icon") ?? string.Empty;

        var materialSlots = string.IsNullOrWhiteSpace(row.Variant.MaterialDefaults)
            ? null
            : JsonSerializer.Deserialize<Dictionary<string, string>>(row.Variant.MaterialDefaults, JsonOpts);

        var collisionBoxes = string.IsNullOrWhiteSpace(row.Variant.CollisionBoxes)
            ? null
            : JsonSerializer.Deserialize<List<CollisionBoxDto>>(row.Variant.CollisionBoxes, JsonOpts);

        IReadOnlyDictionary<string, IReadOnlyList<string>>? textureSlots = null;
        if (textureSlotsByVariant.TryGetValue(row.Variant.Id, out var slots))
        {
            textureSlots = slots;
        }

        return new FurnitureItemDto(
            Type: row.Product.Slug,
            Label: row.Product.Name,
            Width: row.Variant.Width,
            Depth: row.Variant.Depth,
            Height: row.Variant.Height,
            Color: row.Variant.Color,
            Icon: icon,
            Category: row.Category.Name,
            SvgPreview: row.Product.PreviewSvg ?? string.Empty,
            ModelUrl: row.GlbAssetUrl,
            CollisionBoxes: collisionBoxes,
            MaterialSlots: materialSlots,
            TextureSlots: textureSlots,
            VariantId: row.Variant.Id,
            SupplierId: row.Supplier.Id,
            SupplierName: row.Supplier.Name,
            BasePrice: row.Variant.BasePrice,
            Currency: string.IsNullOrWhiteSpace(row.Variant.Currency) ? "EUR" : row.Variant.Currency,
            Family: row.Product.Family.ToString(),
            UnitOfSale: row.Product.UnitOfSale.ToString(),
            CoverageRate: row.Product.CoverageRate,
            WasteFactor: row.Product.WasteFactor,
            TextureUrl: row.Product.TextureUrl);
    }

    private static T? ReadAttribute<T>(string? json, string key)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return default;
        }

        using var doc = JsonDocument.Parse(json);
        if (!doc.RootElement.TryGetProperty(key, out var element))
        {
            return default;
        }

        return element.Deserialize<T>(JsonOpts);
    }

    private sealed class ProjectionRow
    {
        public required Product Product { get; init; }
        public required Category Category { get; init; }
        public required Supplier Supplier { get; init; }
        public required ProductVariant Variant { get; init; }
        public string? GlbAssetUrl { get; init; }
    }
}
