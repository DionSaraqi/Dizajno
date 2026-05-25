using System.ComponentModel.DataAnnotations;

namespace Dizajno.Dto.Supplier;

public sealed record CreateTextureRequest(
    [Required] Guid SupplierId,
    [Required, MaxLength(200)] string Name,
    [Required] Guid AssetId,
    Guid? ThumbnailAssetId,
    IReadOnlyList<string>? Tags,
    int? RepeatU,
    int? RepeatV);
