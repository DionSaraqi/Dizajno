namespace Dizajno.Domain.Entities;

/// <summary>
/// Binds a named material slot on a <see cref="ProductVariant"/> (e.g. "Body", "Pillows")
/// to a <see cref="SupplierTexture"/>. Multiple slots can reference the same texture;
/// at most one row per (variant, slot) is marked default.
/// </summary>
public sealed class ProductVariantTextureSlot
{
    public Guid Id { get; set; }
    public Guid VariantId { get; set; }
    public string SlotName { get; set; } = string.Empty;
    public Guid SupplierTextureId { get; set; }
    public bool IsDefault { get; set; }

    public ProductVariant Variant { get; set; } = null!;
    public SupplierTexture SupplierTexture { get; set; } = null!;
}
