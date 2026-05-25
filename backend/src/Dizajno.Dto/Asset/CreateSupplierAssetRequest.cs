using Dizajno.Domain.Enums;

namespace Dizajno.Dto.Asset;

public sealed record CreateSupplierAssetRequest(
    Guid SupplierId,
    string Key,
    AssetKind Kind,
    string MimeType,
    long SizeBytes,
    string? ChecksumSha256);
