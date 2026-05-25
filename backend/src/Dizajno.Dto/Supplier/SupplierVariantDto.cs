namespace Dizajno.Dto.Supplier;

public sealed record SupplierVariantDto(
    Guid Id,
    Guid ProductId,
    string Sku,
    string Name,
    decimal Width,
    decimal Depth,
    decimal Height,
    string Color,
    decimal? BasePrice,
    string Currency,
    Guid? GlbAssetId,
    string? GlbAssetUrl,
    Guid? SvgPreviewAssetId,
    string? SvgPreviewAssetUrl,
    /// <summary>jsonb: [{ offsetX, offsetZ, width, depth }, ...]. Null = single-AABB from width×depth.</summary>
    string? CollisionBoxes,
    /// <summary>jsonb: {slotName: hexColor}. Drives the customizer's per-slot color pickers.</summary>
    string? MaterialDefaults,
    string Attributes,
    int SortOrder,
    DateTime CreatedAt,
    DateTime UpdatedAt);
