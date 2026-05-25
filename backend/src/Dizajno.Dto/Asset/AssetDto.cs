using Dizajno.Domain.Enums;

namespace Dizajno.Dto.Asset;

public sealed record AssetDto(
    Guid Id,
    AssetKind Kind,
    string Url,
    string MimeType,
    long SizeBytes,
    string? ChecksumSha256,
    Guid? ProductId,
    Guid? VariantId,
    Guid? OwnerSupplierId,
    int SortOrder,
    DateTime CreatedAt);
