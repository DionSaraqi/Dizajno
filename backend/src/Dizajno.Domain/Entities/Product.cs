using Dizajno.Domain.Enums;

namespace Dizajno.Domain.Entities;

public sealed class Product
{
    public Guid Id { get; set; }
    public Guid SupplierId { get; set; }
    public ProductFamily Family { get; set; }
    public Guid CategoryId { get; set; }
    public string Slug { get; set; } = string.Empty;
    public ProductStatus Status { get; set; } = ProductStatus.Draft;
    public UnitOfSale UnitOfSale { get; set; } = UnitOfSale.Piece;
    /// <summary>m² per liter — only meaningful for paint/sealant products.</summary>
    public decimal? CoverageRate { get; set; }
    /// <summary>Default overage factor (e.g. 0.10 = 10%) for area/volume measured products.</summary>
    public decimal WasteFactor { get; set; }
    public int? LeadTimeDays { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    /// <summary>
    /// Inline top-down floor-plan SVG markup used as the sidebar thumbnail.
    /// In Phase 4 this moves to an Asset row generated from CAD.
    /// </summary>
    public string? PreviewSvg { get; set; }
    /// <summary>
    /// Optional URL to a tileable texture image (JPG/PNG under
    /// <c>frontend/public/textures/</c>, or an R2 public URL once assets land
    /// there). Used by the designer's `FloorMesh` and `WallMesh` to skin
    /// surfaces with the variant's appearance. Null = renderer falls back to
    /// <c>ProductVariant.Color</c>.
    /// </summary>
    public string? TextureUrl { get; set; }
    /// <summary>Family-specific JSON attributes (lumen, energy class, ...). Stored as jsonb.</summary>
    public string Attributes { get; set; } = "{}";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Supplier Supplier { get; set; } = null!;
    public Category Category { get; set; } = null!;
    public ICollection<ProductVariant> Variants { get; set; } = new List<ProductVariant>();
}
