using Dizajno.Domain.Enums;

namespace Dizajno.Api.Contracts;

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

public sealed record PresignAssetUploadResponse(
    string Key,
    string UploadUrl,
    DateTime ExpiresAt,
    string PublicUrl,
    Dictionary<string, string> RequiredHeaders);

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

/// <summary>
/// Body of <c>POST /api/supplier/assets/presign</c>. Mirrors the admin presign
/// flow but the asset rows that finalise here are scoped to the calling user's
/// supplier membership. Phase 5 uses these for quote-response attachments
/// (PDFs, drawings); Phase 7 will reuse the same path for product uploads.
/// </summary>
public sealed record PresignSupplierAssetRequest(
    Guid SupplierId,
    AssetKind Kind,
    string ContentType,
    long SizeBytes,
    string? OriginalFileName,
    string? ChecksumSha256);

public sealed record CreateSupplierAssetRequest(
    Guid SupplierId,
    string Key,
    AssetKind Kind,
    string MimeType,
    long SizeBytes,
    string? ChecksumSha256);
