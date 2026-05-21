namespace Dizajno.Domain.Entities;

public sealed class ProductVariant
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public string Sku { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;

    /// <summary>Stock width in meters (X axis).</summary>
    public decimal Width { get; set; }
    /// <summary>Stock depth in meters (Z axis).</summary>
    public decimal Depth { get; set; }
    /// <summary>Stock height in meters (Y axis).</summary>
    public decimal Height { get; set; }

    public string Color { get; set; } = string.Empty;
    public decimal? BasePrice { get; set; }
    public string Currency { get; set; } = "EUR";

    public Guid? GlbAssetId { get; set; }
    public Guid? SvgPreviewAssetId { get; set; }

    /// <summary>Composite collision boxes for non-rectangular shapes (L-sofas). jsonb.</summary>
    public string? CollisionBoxes { get; set; }
    /// <summary>Named material slot defaults: {slotName: hexColor}. jsonb.</summary>
    public string? MaterialDefaults { get; set; }
    /// <summary>Variant-specific JSON attributes. jsonb.</summary>
    public string Attributes { get; set; } = "{}";

    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Product Product { get; set; } = null!;
    public Asset? GlbAsset { get; set; }
    public Asset? SvgPreviewAsset { get; set; }
}
