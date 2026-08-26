using System.Security.Claims;
using System.Text.Json;
using Dizajno.Application.Interfaces;
using Dizajno.Data;
using Dizajno.Domain.Entities;
using Dizajno.Domain.Enums;
using Dizajno.Dto.Asset;
using Dizajno.Dto.Project;
using Dizajno.Dto.Share;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dizajno.Application.Services;

public sealed class ProjectService : IProjectService
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    // Thumbnail upload constraints. Smaller than the catalog-asset image cap
    // because thumbnails are downscaled by the client to ~800x600 before upload.
    private const long ThumbnailMaxBytes = 5L * 1024 * 1024;
    private static readonly HashSet<string> ThumbnailAllowedMimeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/png",
        "image/jpeg",
        "image/webp"
    };

    private readonly DizajnoDbContext _db;
    private readonly IObjectStorage _storage;

    public ProjectService(DizajnoDbContext db, IObjectStorage storage)
    {
        _db = db;
        _storage = storage;
    }

    public async Task<ActionResult<IReadOnlyList<ProjectSummaryDto>>> ListAsync(
        ClaimsPrincipal user,
        int skip,
        int take,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId))
        {
            return new UnauthorizedResult();
        }

        take = Math.Clamp(take, 1, 200);
        skip = Math.Max(0, skip);

        var rows = await _db.Projects
            .AsNoTracking()
            .Where(p => p.OwnerUserId == userId && p.DeletedAt == null)
            .OrderByDescending(p => p.UpdatedAt)
            .Skip(skip)
            .Take(take)
            .Select(p => new ProjectSummaryDto(
                p.Id,
                p.Name,
                p.ThumbnailAsset != null ? p.ThumbnailAsset.Url : null,
                p.CreatedAt,
                p.UpdatedAt))
            .ToListAsync(cancellationToken);

        return new OkObjectResult(rows);
    }

    public async Task<ActionResult<ProjectDetailDto>> CreateAsync(
        CreateProjectRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId))
        {
            return new UnauthorizedResult();
        }
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = "Name is required.",
                Status = StatusCodes.Status400BadRequest
            })
            { StatusCode = StatusCodes.Status400BadRequest };
        }

        var now = DateTime.UtcNow;
        var project = new Project
        {
            Id = Guid.NewGuid(),
            OwnerUserId = userId,
            Name = request.Name.Trim(),
            CreatedAt = now,
            UpdatedAt = now
        };
        _db.Projects.Add(project);
        await _db.SaveChangesAsync(cancellationToken);

        return new ObjectResult(BuildDetail(project, EmptyScene(), Array.Empty<ProjectVersion>()))
        { StatusCode = StatusCodes.Status201Created };
    }

    public async Task<ActionResult<ProjectDetailDto>> GetAsync(
        Guid id,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId))
        {
            return new UnauthorizedResult();
        }

        var project = await LoadOwnedProjectAsync(id, userId, cancellationToken);
        if (project is null)
        {
            return new NotFoundResult();
        }

        var scene = await LoadSceneAsync(id, cancellationToken);
        var versions = await _db.ProjectVersions
            .AsNoTracking()
            .Where(v => v.ProjectId == id)
            .OrderByDescending(v => v.CreatedAt)
            .ToListAsync(cancellationToken);

        return new OkObjectResult(BuildDetail(project, scene, versions));
    }

    public async Task<ActionResult<ProjectDetailDto>> ReplaceSceneAsync(
        Guid id,
        ReplaceSceneRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId))
        {
            return new UnauthorizedResult();
        }

        var project = await LoadOwnedProjectAsync(id, userId, cancellationToken);
        if (project is null)
        {
            return new NotFoundResult();
        }

        var validationError = ValidateScene(request.Scene);
        if (validationError is not null)
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = validationError,
                Status = StatusCodes.Status400BadRequest
            })
            { StatusCode = StatusCodes.Status400BadRequest };
        }

        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
        await ReplaceSceneAsync(id, request.Scene, cancellationToken);
        project.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        var versions = await _db.ProjectVersions
            .AsNoTracking()
            .Where(v => v.ProjectId == id)
            .OrderByDescending(v => v.CreatedAt)
            .ToListAsync(cancellationToken);

        return new OkObjectResult(BuildDetail(project, request.Scene, versions));
    }

    public async Task<ActionResult<ProjectSummaryDto>> UpdateAsync(
        Guid id,
        UpdateProjectRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId))
        {
            return new UnauthorizedResult();
        }

        var project = await LoadOwnedProjectAsync(id, userId, cancellationToken);
        if (project is null)
        {
            return new NotFoundResult();
        }

        if (request.Name is not null)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return new ObjectResult(new ProblemDetails
                {
                    Detail = "Name cannot be empty.",
                    Status = StatusCodes.Status400BadRequest
                })
                { StatusCode = StatusCodes.Status400BadRequest };
            }
            project.Name = request.Name.Trim();
        }
        if (request.ThumbnailAssetId is { } thumbnailAssetId)
        {
            var exists = await _db.Assets.AnyAsync(a => a.Id == thumbnailAssetId, cancellationToken);
            if (!exists)
            {
                return new ObjectResult(new ProblemDetails
                {
                    Detail = "Thumbnail asset not found.",
                    Status = StatusCodes.Status400BadRequest
                })
                { StatusCode = StatusCodes.Status400BadRequest };
            }
            project.ThumbnailAssetId = thumbnailAssetId;
        }
        project.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        var thumbnailUrl = project.ThumbnailAssetId is null
            ? null
            : await _db.Assets
                .Where(a => a.Id == project.ThumbnailAssetId)
                .Select(a => a.Url)
                .SingleOrDefaultAsync(cancellationToken);

        return new OkObjectResult(new ProjectSummaryDto(
            project.Id, project.Name, thumbnailUrl, project.CreatedAt, project.UpdatedAt));
    }

    public async Task<ActionResult<PresignProjectThumbnailResponse>> PresignThumbnailAsync(
        Guid id,
        PresignProjectThumbnailRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId))
        {
            return new UnauthorizedResult();
        }

        var project = await LoadOwnedProjectAsync(id, userId, cancellationToken);
        if (project is null)
        {
            return new NotFoundResult();
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
        var contentType = request.ContentType.Trim().ToLowerInvariant();
        if (!ThumbnailAllowedMimeTypes.Contains(contentType))
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = $"Thumbnail content type '{request.ContentType}' is not allowed. Use PNG, JPEG, or WebP.",
                Status = StatusCodes.Status400BadRequest
            })
            { StatusCode = StatusCodes.Status400BadRequest };
        }
        if (request.SizeBytes <= 0 || request.SizeBytes > ThumbnailMaxBytes)
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = $"Thumbnail size must be between 1 byte and {ThumbnailMaxBytes / (1024 * 1024)} MB.",
                Status = StatusCodes.Status400BadRequest
            })
            { StatusCode = StatusCodes.Status400BadRequest };
        }

        var extension = contentType switch
        {
            "image/png" => ".png",
            "image/jpeg" => ".jpg",
            "image/webp" => ".webp",
            _ => ".png"
        };
        // One key per upload â€” old thumbnails remain in R2 until garbage collected.
        var key = $"projects/{id}/thumbnail-{Guid.NewGuid():N}{extension}";

        PresignedUploadUrl presigned;
        try
        {
            presigned = await _storage.CreatePresignedUploadUrlAsync(
                key, contentType, request.SizeBytes, cancellationToken);
        }
        catch (InvalidOperationException)
        {
            // R2 not configured in this environment â€” surface as 503 so the
            // client can degrade gracefully.
            // The exception message is deliberately NOT forwarded: it names
            // R2:AccessKeyId, R2:SecretAccessKey and the DIZAJNO_R2__* env vars,
            // and the client renders `detail` straight to the user.
            return new ObjectResult(new ProblemDetails
            {
                Detail = "File uploads aren't available right now. Try again shortly.",
                Status = StatusCodes.Status503ServiceUnavailable
            })
            { StatusCode = StatusCodes.Status503ServiceUnavailable };
        }

        return new OkObjectResult(new PresignProjectThumbnailResponse(
            Key: key,
            UploadUrl: presigned.Url,
            ExpiresAt: presigned.ExpiresAt,
            PublicUrl: _storage.GetPublicUrl(key),
            RequiredHeaders: new Dictionary<string, string>(presigned.RequiredHeaders, StringComparer.OrdinalIgnoreCase)));
    }

    public async Task<ActionResult<ProjectSummaryDto>> AttachThumbnailAsync(
        Guid id,
        AttachProjectThumbnailRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId))
        {
            return new UnauthorizedResult();
        }

        var project = await LoadOwnedProjectAsync(id, userId, cancellationToken);
        if (project is null)
        {
            return new NotFoundResult();
        }

        if (string.IsNullOrWhiteSpace(request.Key))
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = "Key is required.",
                Status = StatusCodes.Status400BadRequest
            })
            { StatusCode = StatusCodes.Status400BadRequest };
        }
        if (string.IsNullOrWhiteSpace(request.MimeType) || !ThumbnailAllowedMimeTypes.Contains(request.MimeType))
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = "Invalid mime type.",
                Status = StatusCodes.Status400BadRequest
            })
            { StatusCode = StatusCodes.Status400BadRequest };
        }
        if (request.SizeBytes <= 0 || request.SizeBytes > ThumbnailMaxBytes)
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = "Invalid size.",
                Status = StatusCodes.Status400BadRequest
            })
            { StatusCode = StatusCodes.Status400BadRequest };
        }
        // Defence in depth: only accept keys we issued for this project so an
        // owner can't point their thumbnail at someone else's blob.
        if (!request.Key.StartsWith($"projects/{id}/thumbnail-", StringComparison.Ordinal))
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = "Key does not belong to this project.",
                Status = StatusCodes.Status400BadRequest
            })
            { StatusCode = StatusCodes.Status400BadRequest };
        }

        var asset = new Asset
        {
            Id = Guid.NewGuid(),
            Kind = AssetKind.Image,
            Url = _storage.GetPublicUrl(request.Key),
            MimeType = request.MimeType,
            SizeBytes = request.SizeBytes,
            CreatedAt = DateTime.UtcNow
        };
        _db.Assets.Add(asset);
        project.ThumbnailAssetId = asset.Id;
        project.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        return new OkObjectResult(new ProjectSummaryDto(
            project.Id, project.Name, asset.Url, project.CreatedAt, project.UpdatedAt));
    }

    // â”€â”€ Shares (owner-side) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    public async Task<ActionResult<IReadOnlyList<ShareSummaryDto>>> ListSharesAsync(
        Guid id,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var project = await LoadOwnedProjectAsync(id, userId, cancellationToken);
        if (project is null) return new NotFoundResult();

        var rows = await _db.ProjectShares
            .AsNoTracking()
            .Where(s => s.ProjectId == id)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new ShareSummaryDto(
                s.Id, s.Mode, s.Token, s.InvitedEmail, s.ExpiresAt, s.CreatedAt, s.RevokedAt))
            .ToListAsync(cancellationToken);

        return new OkObjectResult(rows);
    }

    public async Task<ActionResult<ShareSummaryDto>> CreateShareAsync(
        Guid id,
        CreateShareRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var project = await LoadOwnedProjectAsync(id, userId, cancellationToken);
        if (project is null) return new NotFoundResult();

        if (!Enum.IsDefined(typeof(ShareMode), request.Mode))
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = "Invalid share mode.",
                Status = StatusCodes.Status400BadRequest
            })
            { StatusCode = StatusCodes.Status400BadRequest };
        }

        string? token = null;
        string? invitedEmail = null;
        if (request.Kind == ShareKind.Link)
        {
            token = GenerateShareToken();
        }
        else
        {
            if (string.IsNullOrWhiteSpace(request.InvitedEmail))
            {
                return new ObjectResult(new ProblemDetails
                {
                    Detail = "invitedEmail is required for email shares.",
                    Status = StatusCodes.Status400BadRequest
                })
                { StatusCode = StatusCodes.Status400BadRequest };
            }
            invitedEmail = request.InvitedEmail.Trim().ToLowerInvariant();
        }

        var share = new ProjectShare
        {
            Id = Guid.NewGuid(),
            ProjectId = id,
            Mode = request.Mode,
            Token = token,
            InvitedEmail = invitedEmail,
            ExpiresAt = request.ExpiresAt,
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };
        _db.ProjectShares.Add(share);
        await _db.SaveChangesAsync(cancellationToken);

        return new ObjectResult(new ShareSummaryDto(
            share.Id, share.Mode, share.Token, share.InvitedEmail,
            share.ExpiresAt, share.CreatedAt, share.RevokedAt))
        { StatusCode = StatusCodes.Status201Created };
    }

    public async Task<ActionResult> RevokeShareAsync(
        Guid id,
        Guid shareId,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var project = await LoadOwnedProjectAsync(id, userId, cancellationToken);
        if (project is null) return new NotFoundResult();

        var share = await _db.ProjectShares.FirstOrDefaultAsync(
            s => s.Id == shareId && s.ProjectId == id, cancellationToken);
        if (share is null) return new NotFoundResult();

        if (share.RevokedAt is null)
        {
            share.RevokedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(cancellationToken);
        }
        return new NoContentResult();
    }

    // â”€â”€ Comments (owner inbox) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    public async Task<ActionResult<IReadOnlyList<CommentDto>>> ListCommentsAsync(
        Guid id,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var project = await LoadOwnedProjectAsync(id, userId, cancellationToken);
        if (project is null) return new NotFoundResult();

        var rows = await _db.ProjectComments
            .AsNoTracking()
            .Where(c => c.ProjectId == id && c.DeletedAt == null)
            .OrderBy(c => c.CreatedAt)
            .Select(c => new
            {
                c.Id,
                c.ParentCommentId,
                c.AuthorUserId,
                c.GuestName,
                c.Body,
                c.Anchor,
                c.CreatedAt,
                c.ResolvedAt
            })
            .ToListAsync(cancellationToken);

        var authorIds = rows
            .Where(r => r.AuthorUserId != null)
            .Select(r => r.AuthorUserId!.Value)
            .Distinct()
            .ToList();
        var displayNames = authorIds.Count == 0
            ? new Dictionary<Guid, string?>()
            : await _db.Users
                .AsNoTracking()
                .Where(u => authorIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u.DisplayName, cancellationToken);

        var dtos = rows.Select(r => new CommentDto(
            r.Id,
            r.ParentCommentId,
            r.AuthorUserId,
            r.AuthorUserId is null ? null
                : displayNames.TryGetValue(r.AuthorUserId.Value, out var dn) ? dn : null,
            r.GuestName,
            r.Body,
            AnchorParser.Parse(r.Anchor),
            r.CreatedAt,
            r.ResolvedAt
        )).ToList();

        return new OkObjectResult(dtos);
    }

    public async Task<ActionResult> DeleteAsync(
        Guid id,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId))
        {
            return new UnauthorizedResult();
        }

        var project = await LoadOwnedProjectAsync(id, userId, cancellationToken);
        if (project is null)
        {
            return new NotFoundResult();
        }

        project.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return new NoContentResult();
    }

    public async Task<ActionResult<ProjectVersionSummaryDto>> CreateVersionAsync(
        Guid id,
        CreateVersionRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId))
        {
            return new UnauthorizedResult();
        }

        var project = await LoadOwnedProjectAsync(id, userId, cancellationToken);
        if (project is null)
        {
            return new NotFoundResult();
        }
        if (string.IsNullOrWhiteSpace(request.Label))
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = "Label is required.",
                Status = StatusCodes.Status400BadRequest
            })
            { StatusCode = StatusCodes.Status400BadRequest };
        }

        var scene = await LoadSceneAsync(id, cancellationToken);
        var version = new ProjectVersion
        {
            Id = Guid.NewGuid(),
            ProjectId = id,
            Label = request.Label.Trim(),
            SceneSnapshot = JsonSerializer.Serialize(scene, JsonOpts),
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };
        _db.ProjectVersions.Add(version);
        await _db.SaveChangesAsync(cancellationToken);

        return new ObjectResult(new ProjectVersionSummaryDto(
            version.Id, version.Label, version.CreatedByUserId, version.CreatedAt))
        { StatusCode = StatusCodes.Status201Created };
    }

    public async Task<ActionResult<ProjectDetailDto>> RestoreVersionAsync(
        Guid id,
        Guid versionId,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId))
        {
            return new UnauthorizedResult();
        }

        var project = await LoadOwnedProjectAsync(id, userId, cancellationToken);
        if (project is null)
        {
            return new NotFoundResult();
        }

        var version = await _db.ProjectVersions
            .AsNoTracking()
            .FirstOrDefaultAsync(v => v.Id == versionId && v.ProjectId == id, cancellationToken);
        if (version is null)
        {
            return new NotFoundResult();
        }

        var scene = JsonSerializer.Deserialize<SceneDto>(version.SceneSnapshot, JsonOpts)
            ?? EmptyScene();

        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
        await ReplaceSceneAsync(id, scene, cancellationToken);
        project.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        var versions = await _db.ProjectVersions
            .AsNoTracking()
            .Where(v => v.ProjectId == id)
            .OrderByDescending(v => v.CreatedAt)
            .ToListAsync(cancellationToken);

        return new OkObjectResult(BuildDetail(project, scene, versions));
    }

    // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private static bool TryGetUserId(ClaimsPrincipal user, out Guid userId)
    {
        var raw = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? user.FindFirst("sub")?.Value;
        return Guid.TryParse(raw, out userId);
    }

    internal static string GenerateShareToken()
    {
        // 32 url-safe characters from 24 random bytes. Enough entropy that
        // brute-forcing a single token is infeasible.
        Span<byte> bytes = stackalloc byte[24];
        System.Security.Cryptography.RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private Task<Project?> LoadOwnedProjectAsync(Guid id, Guid userId, CancellationToken cancellationToken) =>
        _db.Projects.FirstOrDefaultAsync(
            p => p.Id == id && p.OwnerUserId == userId && p.DeletedAt == null,
            cancellationToken);

    private async Task<SceneDto> LoadSceneAsync(Guid projectId, CancellationToken cancellationToken)
    {
        var walls = await _db.Walls
            .AsNoTracking()
            .Where(w => w.ProjectId == projectId)
            .Select(w => new WallDto(
                w.Id, w.StartX, w.StartZ, w.EndX, w.EndZ, w.Thickness, w.Height,
                w.PaintProductVariantId))
            .ToListAsync(cancellationToken);

        var floorRows = await _db.Floors
            .AsNoTracking()
            .Where(f => f.ProjectId == projectId)
            .Select(f => new { f.Id, f.Vertices, f.FlooringProductVariantId })
            .ToListAsync(cancellationToken);
        var floors = floorRows
            .Select(f => new FloorDto(
                f.Id,
                JsonSerializer.Deserialize<List<List<decimal>>>(f.Vertices, JsonOpts) ?? new(),
                f.FlooringProductVariantId))
            .ToList();

        var openingRows = await _db.Openings
            .AsNoTracking()
            .Where(o => o.ProjectId == projectId)
            .Select(o => new
            {
                o.Id, o.WallId, o.Type, o.OffsetFromStart, o.Width, o.Height, o.SillHeight,
                o.ProductVariantId, o.MaterialOverrides
            })
            .ToListAsync(cancellationToken);
        var openings = openingRows
            .Select(o => new OpeningDto(
                o.Id, o.WallId, o.Type, o.OffsetFromStart, o.Width, o.Height, o.SillHeight,
                o.ProductVariantId,
                o.MaterialOverrides is null
                    ? null
                    : JsonSerializer.Deserialize<Dictionary<string, string>>(o.MaterialOverrides, JsonOpts)))
            .ToList();

        var placedRows = await _db.PlacedItems
            .AsNoTracking()
            .Where(p => p.ProjectId == projectId)
            .Select(p => new
            {
                p.Id, p.ProductVariantId, p.PositionX, p.PositionZ, p.Rotation, p.Elevation, p.Scale,
                p.ScaledWidth, p.ScaledDepth, p.ScaledHeight, p.MaterialColors, p.MaterialTextures
            })
            .ToListAsync(cancellationToken);
        var placed = placedRows
            .Select(p => new PlacedItemDto(
                p.Id, p.ProductVariantId, p.PositionX, p.PositionZ, p.Rotation, p.Elevation, p.Scale,
                p.ScaledWidth, p.ScaledDepth, p.ScaledHeight,
                p.MaterialColors is null
                    ? null
                    : JsonSerializer.Deserialize<Dictionary<string, string>>(p.MaterialColors, JsonOpts),
                p.MaterialTextures is null
                    ? null
                    : JsonSerializer.Deserialize<Dictionary<string, string>>(p.MaterialTextures, JsonOpts)))
            .ToList();

        return new SceneDto(walls, floors, openings, placed);
    }

    private static string? ValidateScene(SceneDto scene)
    {
        var wallIds = scene.Walls.Select(w => w.Id).ToHashSet();
        if (wallIds.Count != scene.Walls.Count)
        {
            return "Duplicate wall id in scene.";
        }
        foreach (var opening in scene.Openings)
        {
            if (!wallIds.Contains(opening.WallId))
            {
                return $"Opening {opening.Id} references unknown wall {opening.WallId}.";
            }
        }
        return null;
    }

    private async Task ReplaceSceneAsync(Guid projectId, SceneDto scene, CancellationToken cancellationToken)
    {
        // Cascade FK from walls â†’ openings: deleting walls also removes openings.
        await _db.PlacedItems.Where(p => p.ProjectId == projectId).ExecuteDeleteAsync(cancellationToken);
        await _db.Floors.Where(f => f.ProjectId == projectId).ExecuteDeleteAsync(cancellationToken);
        await _db.Openings.Where(o => o.ProjectId == projectId).ExecuteDeleteAsync(cancellationToken);
        await _db.Walls.Where(w => w.ProjectId == projectId).ExecuteDeleteAsync(cancellationToken);

        if (scene.Walls.Count > 0)
        {
            _db.Walls.AddRange(scene.Walls.Select(w => new Wall
            {
                Id = w.Id,
                ProjectId = projectId,
                StartX = w.StartX,
                StartZ = w.StartZ,
                EndX = w.EndX,
                EndZ = w.EndZ,
                Thickness = w.Thickness,
                Height = w.Height,
                PaintProductVariantId = w.PaintProductVariantId
            }));
        }

        if (scene.Floors.Count > 0)
        {
            _db.Floors.AddRange(scene.Floors.Select(f => new Floor
            {
                Id = f.Id,
                ProjectId = projectId,
                Vertices = JsonSerializer.Serialize(f.Vertices, JsonOpts),
                FlooringProductVariantId = f.FlooringProductVariantId
            }));
        }

        if (scene.Openings.Count > 0)
        {
            _db.Openings.AddRange(scene.Openings.Select(o => new Opening
            {
                Id = o.Id,
                ProjectId = projectId,
                WallId = o.WallId,
                Type = o.Type,
                OffsetFromStart = o.OffsetFromStart,
                Width = o.Width,
                Height = o.Height,
                SillHeight = o.SillHeight,
                ProductVariantId = o.ProductVariantId,
                MaterialOverrides = o.MaterialOverrides is null
                    ? null
                    : JsonSerializer.Serialize(o.MaterialOverrides, JsonOpts)
            }));
        }

        if (scene.PlacedItems.Count > 0)
        {
            var now = DateTime.UtcNow;
            _db.PlacedItems.AddRange(scene.PlacedItems.Select(p => new PlacedItem
            {
                Id = p.Id,
                ProjectId = projectId,
                ProductVariantId = p.ProductVariantId,
                PositionX = p.PositionX,
                PositionZ = p.PositionZ,
                Rotation = p.Rotation,
                Elevation = p.Elevation,
                Scale = p.Scale,
                ScaledWidth = p.ScaledWidth,
                ScaledDepth = p.ScaledDepth,
                ScaledHeight = p.ScaledHeight,
                MaterialColors = p.MaterialColors is null
                    ? null
                    : JsonSerializer.Serialize(p.MaterialColors, JsonOpts),
                MaterialTextures = p.MaterialTextures is null
                    ? null
                    : JsonSerializer.Serialize(p.MaterialTextures, JsonOpts),
                CreatedAt = now,
                UpdatedAt = now
            }));
        }
    }

    private static ProjectDetailDto BuildDetail(
        Project project,
        SceneDto scene,
        IReadOnlyList<ProjectVersion> versions) =>
        new(
            project.Id,
            project.Name,
            project.ThumbnailAsset?.Url,
            project.ThumbnailAssetId,
            project.CreatedAt,
            project.UpdatedAt,
            scene,
            versions.Select(v => new ProjectVersionSummaryDto(
                v.Id, v.Label, v.CreatedByUserId, v.CreatedAt)).ToList());

    private static SceneDto EmptyScene() => new(
        Array.Empty<WallDto>(),
        Array.Empty<FloorDto>(),
        Array.Empty<OpeningDto>(),
        Array.Empty<PlacedItemDto>());
}
