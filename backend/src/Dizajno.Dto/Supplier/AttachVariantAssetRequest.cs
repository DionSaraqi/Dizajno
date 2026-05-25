using System.ComponentModel.DataAnnotations;

namespace Dizajno.Dto.Supplier;

public sealed record AttachVariantAssetRequest(
    [Required] Guid AssetId);
