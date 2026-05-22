using System.Security.Claims;
using System.Text.Json;
using Dizajno.Api.Contracts;
using Dizajno.Application.Storage;
using Dizajno.Domain.Entities;
using Dizajno.Domain.Enums;
using Dizajno.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dizajno.Api.Controllers;

[ApiController]
[Route("api/projects")]
[Authorize]
public sealed class ProjectsController : ControllerBase
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

    public ProjectsController(DizajnoDbContext db, IObjectStorage storage)
    {
        _db = db;
        _storage = storage;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProjectSummaryDto>>> List(
        CancellationToken cancellationToken,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
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

        return Ok(rows);
    }

    [HttpPost]
    public async Task<ActionResult<ProjectDetailDto>> Create(
        CreateProjectRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Problem("Name is required.", statusCode: StatusCodes.Status400BadRequest);
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

        return StatusCode(
            StatusCodes.Status201Created,
            BuildDetail(project, EmptyScene(), Array.Empty<ProjectVersion>()));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProjectDetailDto>> Get(
        Guid id,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var project = await LoadOwnedProjectAsync(id, userId, cancellationToken);
        if (project is null)
        {
            return NotFound();
        }

        var scene = await LoadSceneAsync(id, cancellationToken);
        var versions = await _db.ProjectVersions
            .AsNoTracking()
            .Where(v => v.ProjectId == id)
            .OrderByDescending(v => v.CreatedAt)
            .ToListAsync(cancellationToken);

        return Ok(BuildDetail(project, scene, versions));
    }

    [HttpPut("{id:guid}/scene")]
    public async Task<ActionResult<ProjectDetailDto>> ReplaceScene(
        Guid id,
        ReplaceSceneRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var project = await LoadOwnedProjectAsync(id, userId, cancellationToken);
        if (project is null)
        {
            return NotFound();
        }

        var validationError = ValidateScene(request.Scene);
        if (validationError is not null)
        {
            return Problem(validationError, statusCode: StatusCodes.Status400BadRequest);
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

        return Ok(BuildDetail(project, request.Scene, versions));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ProjectSummaryDto>> Update(
        Guid id,
        UpdateProjectRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var project = await LoadOwnedProjectAsync(id, userId, cancellationToken);
        if (project is null)
        {
            return NotFound();
        }

        if (request.Name is not null)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return Problem("Name cannot be empty.", statusCode: StatusCodes.Status400BadRequest);
            }
            project.Name = request.Name.Trim();
        }
        if (request.ThumbnailAssetId is { } thumbnailAssetId)
        {
            var exists = await _db.Assets.AnyAsync(a => a.Id == thumbnailAssetId, cancellationToken);
            if (!exists)
            {
                return Problem("Thumbnail asset not found.", statusCode: StatusCodes.Status400BadRequest);
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

        return Ok(new ProjectSummaryDto(
            project.Id, project.Name, thumbnailUrl, project.CreatedAt, project.UpdatedAt));
    }

    [HttpPost("{id:guid}/thumbnail/presign")]
    public async Task<ActionResult<PresignProjectThumbnailResponse>> PresignThumbnail(
        Guid id,
        PresignProjectThumbnailRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var project = await LoadOwnedProjectAsync(id, userId, cancellationToken);
        if (project is null)
        {
            return NotFound();
        }

        if (string.IsNullOrWhiteSpace(request.ContentType))
        {
            return Problem("Content type is required.", statusCode: StatusCodes.Status400BadRequest);
        }
        var contentType = request.ContentType.Trim().ToLowerInvariant();
        if (!ThumbnailAllowedMimeTypes.Contains(contentType))
        {
            return Problem(
                $"Thumbnail content type '{request.ContentType}' is not allowed. Use PNG, JPEG, or WebP.",
                statusCode: StatusCodes.Status400BadRequest);
        }
        if (request.SizeBytes <= 0 || request.SizeBytes > ThumbnailMaxBytes)
        {
            return Problem(
                $"Thumbnail size must be between 1 byte and {ThumbnailMaxBytes / (1024 * 1024)} MB.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        var extension = contentType switch
        {
            "image/png" => ".png",
            "image/jpeg" => ".jpg",
            "image/webp" => ".webp",
            _ => ".png"
        };
        // One key per upload — old thumbnails remain in R2 until garbage collected.
        var key = $"projects/{id}/thumbnail-{Guid.NewGuid():N}{extension}";

        PresignedUploadUrl presigned;
        try
        {
            presigned = await _storage.CreatePresignedUploadUrlAsync(
                key, contentType, request.SizeBytes, cancellationToken);
        }
        catch (InvalidOperationException ex)
        {
            // R2 not configured in this environment — surface as 503 so the
            // client can degrade gracefully.
            return Problem(
                ex.Message,
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }

        return Ok(new PresignProjectThumbnailResponse(
            Key: key,
            UploadUrl: presigned.Url,
            ExpiresAt: presigned.ExpiresAt,
            PublicUrl: _storage.GetPublicUrl(key),
            RequiredHeaders: new Dictionary<string, string>(presigned.RequiredHeaders, StringComparer.OrdinalIgnoreCase)));
    }

    [HttpPut("{id:guid}/thumbnail")]
    public async Task<ActionResult<ProjectSummaryDto>> AttachThumbnail(
        Guid id,
        AttachProjectThumbnailRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var project = await LoadOwnedProjectAsync(id, userId, cancellationToken);
        if (project is null)
        {
            return NotFound();
        }

        if (string.IsNullOrWhiteSpace(request.Key))
        {
            return Problem("Key is required.", statusCode: StatusCodes.Status400BadRequest);
        }
        if (string.IsNullOrWhiteSpace(request.MimeType) || !ThumbnailAllowedMimeTypes.Contains(request.MimeType))
        {
            return Problem("Invalid mime type.", statusCode: StatusCodes.Status400BadRequest);
        }
        if (request.SizeBytes <= 0 || request.SizeBytes > ThumbnailMaxBytes)
        {
            return Problem("Invalid size.", statusCode: StatusCodes.Status400BadRequest);
        }
        // Defence in depth: only accept keys we issued for this project so an
        // owner can't point their thumbnail at someone else's blob.
        if (!request.Key.StartsWith($"projects/{id}/thumbnail-", StringComparison.Ordinal))
        {
            return Problem("Key does not belong to this project.", statusCode: StatusCodes.Status400BadRequest);
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

        return Ok(new ProjectSummaryDto(
            project.Id, project.Name, asset.Url, project.CreatedAt, project.UpdatedAt));
    }

    // ── Shares (owner-side) ────────────────────────────────────────────────

    [HttpGet("{id:guid}/shares")]
    public async Task<ActionResult<IReadOnlyList<ShareSummaryDto>>> ListShares(
        Guid id,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var project = await LoadOwnedProjectAsync(id, userId, cancellationToken);
        if (project is null) return NotFound();

        var rows = await _db.ProjectShares
            .AsNoTracking()
            .Where(s => s.ProjectId == id)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new ShareSummaryDto(
                s.Id, s.Mode, s.Token, s.InvitedEmail, s.ExpiresAt, s.CreatedAt, s.RevokedAt))
            .ToListAsync(cancellationToken);

        return Ok(rows);
    }

    [HttpPost("{id:guid}/shares")]
    public async Task<ActionResult<ShareSummaryDto>> CreateShare(
        Guid id,
        CreateShareRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var project = await LoadOwnedProjectAsync(id, userId, cancellationToken);
        if (project is null) return NotFound();

        if (!Enum.IsDefined(typeof(ShareMode), request.Mode))
        {
            return Problem("Invalid share mode.", statusCode: StatusCodes.Status400BadRequest);
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
                return Problem("invitedEmail is required for email shares.",
                    statusCode: StatusCodes.Status400BadRequest);
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

        return StatusCode(StatusCodes.Status201Created, new ShareSummaryDto(
            share.Id, share.Mode, share.Token, share.InvitedEmail,
            share.ExpiresAt, share.CreatedAt, share.RevokedAt));
    }

    [HttpDelete("{id:guid}/shares/{shareId:guid}")]
    public async Task<ActionResult> RevokeShare(
        Guid id,
        Guid shareId,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var project = await LoadOwnedProjectAsync(id, userId, cancellationToken);
        if (project is null) return NotFound();

        var share = await _db.ProjectShares.FirstOrDefaultAsync(
            s => s.Id == shareId && s.ProjectId == id, cancellationToken);
        if (share is null) return NotFound();

        if (share.RevokedAt is null)
        {
            share.RevokedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(cancellationToken);
        }
        return NoContent();
    }

    // ── Comments (owner inbox) ─────────────────────────────────────────────

    [HttpGet("{id:guid}/comments")]
    public async Task<ActionResult<IReadOnlyList<CommentDto>>> ListComments(
        Guid id,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var project = await LoadOwnedProjectAsync(id, userId, cancellationToken);
        if (project is null) return NotFound();

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
            ParseAnchor(r.Anchor),
            r.CreatedAt,
            r.ResolvedAt
        )).ToList();

        return Ok(dtos);
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var project = await LoadOwnedProjectAsync(id, userId, cancellationToken);
        if (project is null)
        {
            return NotFound();
        }

        project.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:guid}/versions")]
    public async Task<ActionResult<ProjectVersionSummaryDto>> CreateVersion(
        Guid id,
        CreateVersionRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var project = await LoadOwnedProjectAsync(id, userId, cancellationToken);
        if (project is null)
        {
            return NotFound();
        }
        if (string.IsNullOrWhiteSpace(request.Label))
        {
            return Problem("Label is required.", statusCode: StatusCodes.Status400BadRequest);
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

        return StatusCode(StatusCodes.Status201Created, new ProjectVersionSummaryDto(
            version.Id, version.Label, version.CreatedByUserId, version.CreatedAt));
    }

    [HttpPost("{id:guid}/versions/{versionId:guid}/restore")]
    public async Task<ActionResult<ProjectDetailDto>> RestoreVersion(
        Guid id,
        Guid versionId,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var project = await LoadOwnedProjectAsync(id, userId, cancellationToken);
        if (project is null)
        {
            return NotFound();
        }

        var version = await _db.ProjectVersions
            .AsNoTracking()
            .FirstOrDefaultAsync(v => v.Id == versionId && v.ProjectId == id, cancellationToken);
        if (version is null)
        {
            return NotFound();
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

        return Ok(BuildDetail(project, scene, versions));
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private bool TryGetUserId(out Guid userId)
    {
        var raw = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value;
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

    internal static System.Text.Json.JsonElement? ParseAnchor(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            return doc.RootElement.Clone();
        }
        catch
        {
            return null;
        }
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
            .Select(w => new WallDto(w.Id, w.StartX, w.StartZ, w.EndX, w.EndZ, w.Thickness, w.Height))
            .ToListAsync(cancellationToken);

        var floorRows = await _db.Floors
            .AsNoTracking()
            .Where(f => f.ProjectId == projectId)
            .Select(f => new { f.Id, f.Vertices })
            .ToListAsync(cancellationToken);
        var floors = floorRows
            .Select(f => new FloorDto(
                f.Id,
                JsonSerializer.Deserialize<List<List<decimal>>>(f.Vertices, JsonOpts) ?? new()))
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
                p.Id, p.ProductVariantId, p.PositionX, p.PositionZ, p.Rotation, p.Scale,
                p.ScaledWidth, p.ScaledDepth, p.ScaledHeight, p.MaterialColors, p.MaterialTextures
            })
            .ToListAsync(cancellationToken);
        var placed = placedRows
            .Select(p => new PlacedItemDto(
                p.Id, p.ProductVariantId, p.PositionX, p.PositionZ, p.Rotation, p.Scale,
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
        // Cascade FK from walls → openings: deleting walls also removes openings.
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
                Height = w.Height
            }));
        }

        if (scene.Floors.Count > 0)
        {
            _db.Floors.AddRange(scene.Floors.Select(f => new Floor
            {
                Id = f.Id,
                ProjectId = projectId,
                Vertices = JsonSerializer.Serialize(f.Vertices, JsonOpts)
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
