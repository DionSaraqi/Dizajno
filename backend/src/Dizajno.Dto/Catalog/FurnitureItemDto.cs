namespace Dizajno.Dto.Catalog;

/// <summary>
/// Shape designed to drop into the frontend's FurnitureCatalogItem TypeScript type
/// with no changes — every field maps 1:1.
/// </summary>
public sealed record FurnitureItemDto(
    string Type,
    string Label,
    decimal Width,
    decimal Depth,
    decimal Height,
    string Color,
    string Icon,
    string Category,
    string SvgPreview,
    string? ModelUrl,
    IReadOnlyList<CollisionBoxDto>? CollisionBoxes,
    IReadOnlyDictionary<string, string>? MaterialSlots,
    IReadOnlyDictionary<string, IReadOnlyList<string>>? TextureSlots,
    Guid VariantId,
    Guid SupplierId,
    string SupplierName,
    decimal? BasePrice,
    string Currency,
    // ── Phase 6 additions ───────────────────────────────────────────────
    // Family lets the frontend filter "place-on-canvas" furniture from
    // building materials (paint/flooring) that flow through the materials
    // section in RequestQuoteDialog. UnitOfSale + CoverageRate + WasteFactor
    // drive the auto-calculated quantity suggestion for those items.
    string Family,
    string UnitOfSale,
    decimal? CoverageRate,
    decimal WasteFactor,
    string? TextureUrl,
    // Tall, against-the-wall items (wardrobes, bookshelves). When true the
    // frontend placement/snap pipeline auto-orients the item so its longest
    // side runs parallel to the wall it snaps to. Sourced from the
    // Product.Attributes jsonb ("wallHugging"), same pattern as Icon.
    bool WallHugging);
