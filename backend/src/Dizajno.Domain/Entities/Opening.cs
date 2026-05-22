using Dizajno.Domain.Enums;

namespace Dizajno.Domain.Entities;

public sealed class Opening
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public Guid WallId { get; set; }
    public OpeningType Type { get; set; }
    public decimal OffsetFromStart { get; set; }
    public decimal Width { get; set; }
    public decimal Height { get; set; }
    public decimal SillHeight { get; set; }
    /// <summary>
    /// Optional FK to a branded fixture variant (Phase 6). Null = generic
    /// door/window cut into the wall.
    /// </summary>
    public Guid? ProductVariantId { get; set; }
    public string? MaterialOverrides { get; set; }

    public Project Project { get; set; } = null!;
    public Wall Wall { get; set; } = null!;
    public ProductVariant? ProductVariant { get; set; }
}
