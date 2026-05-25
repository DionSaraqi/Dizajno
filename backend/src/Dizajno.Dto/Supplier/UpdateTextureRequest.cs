using System.ComponentModel.DataAnnotations;

namespace Dizajno.Dto.Supplier;

public sealed record UpdateTextureRequest(
    [Required, MaxLength(200)] string Name,
    Guid? ThumbnailAssetId,
    IReadOnlyList<string>? Tags,
    int? RepeatU,
    int? RepeatV);
