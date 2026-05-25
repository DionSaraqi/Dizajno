namespace Dizajno.Dto.Supplier;

public sealed record VariantTextureSlotDto(
    Guid Id,
    Guid VariantId,
    string SlotName,
    Guid SupplierTextureId,
    string SupplierTextureName,
    string AssetUrl,
    bool IsDefault);
