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
                Variant = p.Variants.OrderBy(v => v.SortOrder).First(),
                GlbAssetUrl = p.Variants
                    .OrderBy(v => v.SortOrder)
                    .Select(v => v.GlbAsset!.Url)
                    .FirstOrDefault()
            })
            .ToListAsync(cancellationToken);

        var items = rows.Select(ToDto).ToList();
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

        return Ok(ToDto(row));
    }

    [HttpGet("categories")]
    public async Task<ActionResult<IReadOnlyList<CategoryDto>>> GetCategories(
        CancellationToken cancellationToken,
        [FromQuery] string? family = null)
    {
        var query = _db.Categories.AsQueryable();

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
            .OrderBy(s => s.Name)
            .Select(s => new SupplierDto(s.Slug, s.Name, s.LogoAsset!.Url))
            .ToListAsync(cancellationToken);
        return Ok(list);
    }

    private IQueryable<Product> BuildPublishedProductQuery() =>
        _db.Products
            .AsNoTracking()
            .Where(p => p.Status == ProductStatus.Published);

    private static FurnitureItemDto ToDto(ProjectionRow row)
    {
        var icon = ReadAttribute<string>(row.Product.Attributes, "icon") ?? string.Empty;
        var textureSlots = ReadAttribute<Dictionary<string, IReadOnlyList<string>>>(
            row.Variant.Attributes, "textureSlots");

        var materialSlots = string.IsNullOrWhiteSpace(row.Variant.MaterialDefaults)
            ? null
            : JsonSerializer.Deserialize<Dictionary<string, string>>(row.Variant.MaterialDefaults, JsonOpts);

        var collisionBoxes = string.IsNullOrWhiteSpace(row.Variant.CollisionBoxes)
            ? null
            : JsonSerializer.Deserialize<List<CollisionBoxDto>>(row.Variant.CollisionBoxes, JsonOpts);

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
            VariantId: row.Variant.Id);
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
        public required ProductVariant Variant { get; init; }
        public string? GlbAssetUrl { get; init; }
    }
}
