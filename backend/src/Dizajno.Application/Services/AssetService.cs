using Dizajno.Application.Interfaces;
using Dizajno.Data;
using Dizajno.Domain.Entities;
using Dizajno.Domain.Enums;
using Dizajno.Dto.Asset;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dizajno.Application.Services;

public sealed class AssetService : IAssetService
{
    private readonly DizajnoDbContext _db;
    private readonly IObjectStorage _storage;

    public AssetService(DizajnoDbContext db, IObjectStorage storage)
    {
        _db = db;
        _storage = storage;
    }

    public async Task<ActionResult<PresignAssetUploadResponse>> PresignAsync(
        PresignAssetUploadRequest request,
        CancellationToken cancellationToken)
    {
        if (!Enum.IsDefined(typeof(AssetKind), request.Kind))
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = "Unknown asset kind.",
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
        var key = $"assets/{rules.KeySegment}/{Guid.NewGuid():N}{extension}";

        var presigned = await _storage.CreatePresignedUploadUrlAsync(
            key,
            contentType,
            request.SizeBytes,
            cancellationToken);

        var publicUrl = _storage.GetPublicUrl(key);

        return new OkObjectResult(new PresignAssetUploadResponse(
            Key: key,
            UploadUrl: presigned.Url,
            ExpiresAt: presigned.ExpiresAt,
            PublicUrl: publicUrl,
            RequiredHeaders: new Dictionary<string, string>(presigned.RequiredHeaders, StringComparer.OrdinalIgnoreCase)));
    }

    public async Task<ActionResult<AssetDto>> CreateAsync(
        CreateAssetRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Key))
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = "Key is required.",
                Status = StatusCodes.Status400BadRequest
            })
            { StatusCode = StatusCodes.Status400BadRequest };
        }
        if (!Enum.IsDefined(typeof(AssetKind), request.Kind))
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = "Unknown asset kind.",
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

        if (request.ProductId is { } productId &&
            !await _db.Products.AnyAsync(p => p.Id == productId, cancellationToken))
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = "Product not found.",
                Status = StatusCodes.Status400BadRequest
            })
            { StatusCode = StatusCodes.Status400BadRequest };
        }
        if (request.VariantId is { } variantId &&
            !await _db.ProductVariants.AnyAsync(v => v.Id == variantId, cancellationToken))
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = "Variant not found.",
                Status = StatusCodes.Status400BadRequest
            })
            { StatusCode = StatusCodes.Status400BadRequest };
        }
        if (request.OwnerSupplierId is { } supplierId &&
            !await _db.Suppliers.AnyAsync(s => s.Id == supplierId, cancellationToken))
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = "Supplier not found.",
                Status = StatusCodes.Status400BadRequest
            })
            { StatusCode = StatusCodes.Status400BadRequest };
        }

        var asset = new Asset
        {
            Id = Guid.NewGuid(),
            ProductId = request.ProductId,
            VariantId = request.VariantId,
            OwnerSupplierId = request.OwnerSupplierId,
            Kind = request.Kind,
            Url = _storage.GetPublicUrl(request.Key),
            MimeType = request.MimeType,
            SizeBytes = request.SizeBytes,
            ChecksumSha256 = request.ChecksumSha256,
            SortOrder = request.SortOrder,
            CreatedAt = DateTime.UtcNow
        };

        _db.Assets.Add(asset);
        await _db.SaveChangesAsync(cancellationToken);

        var dto = new AssetDto(
            Id: asset.Id,
            Kind: asset.Kind,
            Url: asset.Url,
            MimeType: asset.MimeType,
            SizeBytes: asset.SizeBytes,
            ChecksumSha256: asset.ChecksumSha256,
            ProductId: asset.ProductId,
            VariantId: asset.VariantId,
            OwnerSupplierId: asset.OwnerSupplierId,
            SortOrder: asset.SortOrder,
            CreatedAt: asset.CreatedAt);

        return new ObjectResult(dto) { StatusCode = StatusCodes.Status201Created };
    }
}

/// <summary>
/// Per-<see cref="AssetKind"/> allow-list of MIME types and a size cap. Centralised
/// here so the presign endpoint and any future direct-upload endpoint share one
/// source of truth.
/// </summary>
public sealed record AssetUploadRules(
    string KeySegment,
    long MaxBytes,
    IReadOnlySet<string> AllowedMimeTypes,
    bool AllowAnyMime = false)
{
    public bool IsAllowedMime(string contentType) =>
        AllowAnyMime || AllowedMimeTypes.Contains(contentType);

    public static AssetUploadRules For(AssetKind kind) => kind switch
    {
        AssetKind.Glb => new(
            KeySegment: "glb",
            MaxBytes: 50L * 1024 * 1024,
            AllowedMimeTypes: new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "model/gltf-binary",
                "application/octet-stream"
            }),
        AssetKind.SvgPreview => new(
            KeySegment: "svg",
            MaxBytes: 1L * 1024 * 1024,
            AllowedMimeTypes: new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "image/svg+xml"
            }),
        AssetKind.Image => new(
            KeySegment: "image",
            MaxBytes: 10L * 1024 * 1024,
            AllowedMimeTypes: new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "image/png",
                "image/jpeg",
                "image/webp"
            }),
        AssetKind.CadSource => new(
            KeySegment: "cad",
            MaxBytes: 100L * 1024 * 1024,
            AllowedMimeTypes: new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "application/octet-stream",
                "image/vnd.dwg",
                "image/vnd.dxf"
            }),
        AssetKind.Doc => new(
            KeySegment: "doc",
            MaxBytes: 25L * 1024 * 1024,
            AllowedMimeTypes: new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "application/pdf"
            }),
        AssetKind.Attachment => new(
            KeySegment: "attachment",
            MaxBytes: 25L * 1024 * 1024,
            AllowedMimeTypes: new HashSet<string>(StringComparer.OrdinalIgnoreCase),
            AllowAnyMime: true),
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown asset kind.")
    };

    public static string PickExtension(AssetKind kind, string contentType, string? originalFileName)
    {
        // Prefer a sensible extension by kind/MIME; fall back to the original file
        // extension if present and looks safe.
        var byKind = kind switch
        {
            AssetKind.Glb => ".glb",
            AssetKind.SvgPreview => ".svg",
            AssetKind.Image => contentType switch
            {
                "image/png" => ".png",
                "image/jpeg" => ".jpg",
                "image/webp" => ".webp",
                _ => null
            },
            AssetKind.Doc => ".pdf",
            _ => null
        };
        if (byKind is not null)
        {
            return byKind;
        }

        if (!string.IsNullOrWhiteSpace(originalFileName))
        {
            var ext = Path.GetExtension(originalFileName);
            if (!string.IsNullOrEmpty(ext) && ext.Length <= 8 && ext.All(c => char.IsLetterOrDigit(c) || c == '.'))
            {
                return ext.ToLowerInvariant();
            }
        }

        return ".bin";
    }
}
