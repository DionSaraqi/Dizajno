namespace Dizajno.Domain.Entities;

public sealed class Floor
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    /// <summary>jsonb array of <c>[x, z]</c> tuples forming the floor polygon.</summary>
    public string Vertices { get; set; } = "[]";
    /// <summary>
    /// Optional FK to a BuildingMaterial-family Flooring variant. When set,
    /// the polygon renders with the variant's texture/color in the designer
    /// and becomes a quote line at fan-out time. Null = bare floor (default).
    /// </summary>
    public Guid? FlooringProductVariantId { get; set; }

    public Project Project { get; set; } = null!;
    public ProductVariant? FlooringProductVariant { get; set; }
}
