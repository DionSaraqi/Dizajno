namespace Dizajno.Domain.Entities;

public sealed class Wall
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public decimal StartX { get; set; }
    public decimal StartZ { get; set; }
    public decimal EndX { get; set; }
    public decimal EndZ { get; set; }
    public decimal Thickness { get; set; }
    public decimal Height { get; set; }
    /// <summary>
    /// Optional FK to a BuildingMaterial-family Paint variant. When set,
    /// the wall renders with the variant's texture/color in the designer and
    /// becomes a quote line at fan-out time. Null = unpainted (default).
    /// </summary>
    public Guid? PaintProductVariantId { get; set; }

    public Project Project { get; set; } = null!;
    public ProductVariant? PaintProductVariant { get; set; }
}
