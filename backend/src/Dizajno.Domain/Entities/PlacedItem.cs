namespace Dizajno.Domain.Entities;

public sealed class PlacedItem
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public Guid ProductVariantId { get; set; }
    public decimal PositionX { get; set; }
    public decimal PositionZ { get; set; }
    /// <summary>Rotation around the Y axis in radians.</summary>
    public decimal Rotation { get; set; }
    public decimal Scale { get; set; } = 1m;
    /// <summary>
    /// Cached final dimensions after the scale multiplier is applied. Stored so a
    /// quote line can reference the user-chosen size without recomputing.
    /// </summary>
    public decimal ScaledWidth { get; set; }
    public decimal ScaledDepth { get; set; }
    public decimal ScaledHeight { get; set; }
    public string? MaterialColors { get; set; }
    public string? MaterialTextures { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Project Project { get; set; } = null!;
    public ProductVariant ProductVariant { get; set; } = null!;
}
