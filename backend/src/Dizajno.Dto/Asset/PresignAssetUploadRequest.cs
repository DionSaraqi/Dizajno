using Dizajno.Domain.Enums;

namespace Dizajno.Dto.Asset;

/// <summary>
/// Body of <c>POST /api/admin/assets/presign</c>. Returns a short-lived URL the
/// admin client can PUT the file to directly.
/// </summary>
public sealed record PresignAssetUploadRequest(
    AssetKind Kind,
    string ContentType,
    long SizeBytes,
    string? OriginalFileName,
    string? ChecksumSha256);
