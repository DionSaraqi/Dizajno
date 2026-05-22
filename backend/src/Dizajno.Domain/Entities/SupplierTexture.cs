namespace Dizajno.Domain.Entities;

/// <summary>
/// A texture owned by a <see cref="Supplier"/>'s library (fabric, finish, wood grain, ...).
/// Variants opt in via <see cref="ProductVariantTextureSlot"/>; a Postgres trigger
/// enforces that a slot's variant belongs to the texture's supplier.
/// </summary>
public sealed class SupplierTexture
{
    public Guid Id { get; set; }
    public Guid SupplierId { get; set; }
    public string Name { get; set; } = string.Empty;
    public Guid AssetId { get; set; }
    public Guid? ThumbnailAssetId { get; set; }
    public string[] Tags { get; set; } = Array.Empty<string>();
    public int RepeatU { get; set; } = 4;
    public int RepeatV { get; set; } = 4;
    public DateTime CreatedAt { get; set; }

    public Supplier Supplier { get; set; } = null!;
    public Asset Asset { get; set; } = null!;
    public Asset? ThumbnailAsset { get; set; }
}
