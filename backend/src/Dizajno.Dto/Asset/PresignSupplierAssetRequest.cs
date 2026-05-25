using Dizajno.Domain.Enums;

namespace Dizajno.Dto.Asset;

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
