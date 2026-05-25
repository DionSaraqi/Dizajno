using Dizajno.Domain.Enums;

namespace Dizajno.Dto.Asset;

/// <summary>
/// Body of <c>POST /api/admin/assets</c> — record an upload that has already
/// completed against R2. The server derives the public URL from <see cref="Key"/>
/// + the configured public base URL.
/// </summary>
public sealed record CreateAssetRequest(
    string Key,
    AssetKind Kind,
    string MimeType,
    long SizeBytes,
    string? ChecksumSha256,
    Guid? ProductId,
    Guid? VariantId,
    Guid? OwnerSupplierId,
    int SortOrder);
