using System.Security.Claims;
using Dizajno.Api.Contracts;
using Dizajno.Application.Storage;
using Dizajno.Application.Suppliers;
using Dizajno.Domain.Entities;
using Dizajno.Domain.Enums;
using Dizajno.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Api.Controllers;

/// <summary>
/// Phase 5 — supplier-scoped wrapper around the R2 presign + finalize flow.
/// Mirrors <see cref="AssetsController"/> but takes the supplier id from the
/// request and validates it against the caller's <see cref="ISupplierMembershipResolver"/>
/// results instead of requiring the Admin role. Phase 7's portal reuses this
/// path for product uploads.
/// </summary>
[ApiController]
[Route("api/supplier/assets")]
[Authorize]
public sealed class SupplierAssetsController : ControllerBase
{
    private readonly DizajnoDbContext _db;
    private readonly IObjectStorage _storage;
    private readonly ISupplierMembershipResolver _memberships;

    public SupplierAssetsController(
        DizajnoDbContext db,
        IObjectStorage storage,
        ISupplierMembershipResolver memberships)
    {
        _db = db;
        _storage = storage;
        _memberships = memberships;
    }

    [HttpPost("presign")]
    public async Task<ActionResult<PresignAssetUploadResponse>> Presign(
        PresignSupplierAssetRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);
        if (!memberships.Any(m => m.SupplierId == request.SupplierId && !m.IsSuspended)) return Forbid();

        if (request.Kind is not (AssetKind.Image or AssetKind.Doc or AssetKind.Attachment))
        {
            return Problem(
                "Supplier uploads accept Image, Doc, or Attachment kinds.",
                statusCode: StatusCodes.Status400BadRequest);
        }
        if (string.IsNullOrWhiteSpace(request.ContentType))
        {
            return Problem("Content type is required.", statusCode: StatusCodes.Status400BadRequest);
        }
        if (request.SizeBytes <= 0)
        {
            return Problem("Size must be greater than zero.", statusCode: StatusCodes.Status400BadRequest);
        }

        var rules = AssetUploadRules.For(request.Kind);
        if (request.SizeBytes > rules.MaxBytes)
        {
            return Problem(
                $"File too large for {request.Kind}. Max {rules.MaxBytes / (1024 * 1024)} MB.",
                statusCode: StatusCodes.Status400BadRequest);
        }
        var contentType = request.ContentType.Trim().ToLowerInvariant();
        if (!rules.IsAllowedMime(contentType))
        {
            return Problem(
                $"Content type '{request.ContentType}' is not allowed for {request.Kind}.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        var extension = AssetUploadRules.PickExtension(request.Kind, contentType, request.OriginalFileName);
        var key = $"suppliers/{request.SupplierId}/{rules.KeySegment}/{Guid.NewGuid():N}{extension}";

        PresignedUploadUrl presigned;
        try
        {
            presigned = await _storage.CreatePresignedUploadUrlAsync(
                key, contentType, request.SizeBytes, cancellationToken);
        }
        catch (InvalidOperationException ex)
        {
            return Problem(ex.Message, statusCode: StatusCodes.Status503ServiceUnavailable);
        }

        return Ok(new PresignAssetUploadResponse(
            Key: key,
            UploadUrl: presigned.Url,
            ExpiresAt: presigned.ExpiresAt,
            PublicUrl: _storage.GetPublicUrl(key),
            RequiredHeaders: new Dictionary<string, string>(presigned.RequiredHeaders, StringComparer.OrdinalIgnoreCase)));
    }

    [HttpPost]
    public async Task<ActionResult<AssetDto>> Create(
        CreateSupplierAssetRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);
        if (!memberships.Any(m => m.SupplierId == request.SupplierId && !m.IsSuspended)) return Forbid();

        if (string.IsNullOrWhiteSpace(request.Key))
        {
            return Problem("Key is required.", statusCode: StatusCodes.Status400BadRequest);
        }
        if (string.IsNullOrWhiteSpace(request.MimeType))
        {
            return Problem("MIME type is required.", statusCode: StatusCodes.Status400BadRequest);
        }
        if (request.SizeBytes <= 0)
        {
            return Problem("Size must be greater than zero.", statusCode: StatusCodes.Status400BadRequest);
        }
        // Defence in depth: the key must live under the supplier's namespace.
        if (!request.Key.StartsWith($"suppliers/{request.SupplierId}/", StringComparison.Ordinal))
        {
            return Problem(
                "Key does not belong to this supplier.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        var asset = new Asset
        {
            Id = Guid.NewGuid(),
            OwnerSupplierId = request.SupplierId,
            Kind = request.Kind,
            Url = _storage.GetPublicUrl(request.Key),
            MimeType = request.MimeType,
            SizeBytes = request.SizeBytes,
            ChecksumSha256 = request.ChecksumSha256,
            SortOrder = 0,
            CreatedAt = DateTime.UtcNow
        };
        _db.Assets.Add(asset);
        await _db.SaveChangesAsync(cancellationToken);

        return StatusCode(StatusCodes.Status201Created, new AssetDto(
            asset.Id, asset.Kind, asset.Url, asset.MimeType, asset.SizeBytes, asset.ChecksumSha256,
            asset.ProductId, asset.VariantId, asset.OwnerSupplierId, asset.SortOrder, asset.CreatedAt));
    }

    private bool TryGetUserId(out Guid userId)
    {
        var raw = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(raw, out userId);
    }
}
