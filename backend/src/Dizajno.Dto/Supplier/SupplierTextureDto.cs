namespace Dizajno.Dto.Supplier;

public sealed record SupplierTextureDto(
    Guid Id,
    Guid SupplierId,
    string Name,
    Guid AssetId,
    string AssetUrl,
    Guid? ThumbnailAssetId,
    string? ThumbnailAssetUrl,
    IReadOnlyList<string> Tags,
    int RepeatU,
    int RepeatV,
    int SlotBindingCount,
    DateTime CreatedAt);
