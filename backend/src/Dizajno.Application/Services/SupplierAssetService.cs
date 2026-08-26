using System.Security.Claims;
using Dizajno.Application.Interfaces;
using Dizajno.Data;
using Dizajno.Domain.Entities;
using Dizajno.Domain.Enums;
using Dizajno.Dto.Asset;
using Dizajno.Dto.Supplier;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Application.Services;

public sealed class SupplierAssetService : ISupplierAssetService
{
    private readonly DizajnoDbContext _db;
    private readonly IObjectStorage _storage;
    private readonly ISupplierMembershipResolver _memberships;

    public SupplierAssetService(
        DizajnoDbContext db,
        IObjectStorage storage,
        ISupplierMembershipResolver memberships)
    {
        _db = db;
        _storage = storage;
        _memberships = memberships;
    }

    public async Task<ActionResult<PresignAssetUploadResponse>> PresignAsync(
        PresignSupplierAssetRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);
        if (!memberships.Any(m => m.SupplierId == request.SupplierId && !m.IsSuspended)) return new ForbidResult();

        // Phase 7b: Glb + SvgPreview added so suppliers can upload their own
        // GLB models and floor-plan SVGs. CadSource is still admin-only —
        // converting DXF/DWG → GLB is a future pipeline (see PLAN.md).
        if (request.Kind is not (
            AssetKind.Image or AssetKind.Doc or AssetKind.Attachment or
            AssetKind.Glb or AssetKind.SvgPreview))
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = "Supplier uploads accept Image, Doc, Attachment, Glb, or SvgPreview kinds.",
                Status = StatusCodes.Status400BadRequest
            })
            { StatusCode = StatusCodes.Status400BadRequest };
        }
        if (string.IsNullOrWhiteSpace(request.ContentType))
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = "Content type is required.",
                Status = StatusCodes.Status400BadRequest
            })
            { StatusCode = StatusCodes.Status400BadRequest };
        }
        if (request.SizeBytes <= 0)
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = "Size must be greater than zero.",
                Status = StatusCodes.Status400BadRequest
            })
            { StatusCode = StatusCodes.Status400BadRequest };
        }

        var rules = AssetUploadRules.For(request.Kind);
        if (request.SizeBytes > rules.MaxBytes)
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = $"File too large for {request.Kind}. Max {rules.MaxBytes / (1024 * 1024)} MB.",
                Status = StatusCodes.Status400BadRequest
            })
            { StatusCode = StatusCodes.Status400BadRequest };
        }
        var contentType = request.ContentType.Trim().ToLowerInvariant();
        if (!rules.IsAllowedMime(contentType))
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = $"Content type '{request.ContentType}' is not allowed for {request.Kind}.",
                Status = StatusCodes.Status400BadRequest
            })
            { StatusCode = StatusCodes.Status400BadRequest };
        }

        var extension = AssetUploadRules.PickExtension(request.Kind, contentType, request.OriginalFileName);
        var key = $"suppliers/{request.SupplierId}/{rules.KeySegment}/{Guid.NewGuid():N}{extension}";

        PresignedUploadUrl presigned;
        try
        {
            presigned = await _storage.CreatePresignedUploadUrlAsync(
                key, contentType, request.SizeBytes, cancellationToken);
        }
        catch (InvalidOperationException)
        {
            // See ProjectService: the exception message names R2 credential
            // configuration keys, and the client renders `detail` to the user.
            return new ObjectResult(new ProblemDetails
            {
                Detail = "File uploads aren't available right now. Try again shortly.",
                Status = StatusCodes.Status503ServiceUnavailable
            })
            { StatusCode = StatusCodes.Status503ServiceUnavailable };
        }

        return new OkObjectResult(new PresignAssetUploadResponse(
            Key: key,
            UploadUrl: presigned.Url,
            ExpiresAt: presigned.ExpiresAt,
            PublicUrl: _storage.GetPublicUrl(key),
            RequiredHeaders: new Dictionary<string, string>(presigned.RequiredHeaders, StringComparer.OrdinalIgnoreCase)));
    }

    public async Task<ActionResult<AssetDto>> CreateAsync(
        CreateSupplierAssetRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);
        if (!memberships.Any(m => m.SupplierId == request.SupplierId && !m.IsSuspended)) return new ForbidResult();

        if (string.IsNullOrWhiteSpace(request.Key))
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = "Key is required.",
                Status = StatusCodes.Status400BadRequest
            })
            { StatusCode = StatusCodes.Status400BadRequest };
        }
        if (string.IsNullOrWhiteSpace(request.MimeType))
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = "MIME type is required.",
                Status = StatusCodes.Status400BadRequest
            })
            { StatusCode = StatusCodes.Status400BadRequest };
        }
        if (request.SizeBytes <= 0)
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = "Size must be greater than zero.",
                Status = StatusCodes.Status400BadRequest
            })
            { StatusCode = StatusCodes.Status400BadRequest };
        }
        // Defence in depth: the key must live under the supplier's namespace.
        if (!request.Key.StartsWith($"suppliers/{request.SupplierId}/", StringComparison.Ordinal))
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = "Key does not belong to this supplier.",
                Status = StatusCodes.Status400BadRequest
            })
            { StatusCode = StatusCodes.Status400BadRequest };
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

        return new ObjectResult(new AssetDto(
            asset.Id, asset.Kind, asset.Url, asset.MimeType, asset.SizeBytes, asset.ChecksumSha256,
            asset.ProductId, asset.VariantId, asset.OwnerSupplierId, asset.SortOrder, asset.CreatedAt))
        { StatusCode = StatusCodes.Status201Created };
    }

    private static bool TryGetUserId(ClaimsPrincipal user, out Guid userId)
    {
        var raw = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? user.FindFirst("sub")?.Value;
        return Guid.TryParse(raw, out userId);
    }
}
