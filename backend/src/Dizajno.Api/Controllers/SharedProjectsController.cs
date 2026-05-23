using System.Text.Json;
using Dizajno.Api.Contracts;
using Dizajno.Domain.Entities;
using Dizajno.Domain.Enums;
using Dizajno.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dizajno.Api.Controllers;

/// <summary>
/// Public, token-scoped view of a project: lets anyone with a non-revoked
/// share link load the scene and (in Comment mode) read/post comments. No
/// bearer required, but signed-in users get their identity recorded on any
/// comments they post via the same endpoint.
/// </summary>
[ApiController]
[Route("api/share")]
[AllowAnonymous]
public sealed class SharedProjectsController : ControllerBase
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    private readonly DizajnoDbContext _db;

    public SharedProjectsController(DizajnoDbContext db) => _db = db;

    [HttpGet("{token}")]
    public async Task<ActionResult<SharedProjectDto>> Load(
        string token,
        CancellationToken cancellationToken)
    {
        var share = await ResolveShareAsync(token, cancellationToken);
        if (share is null) return NotFound();

        var project = await _db.Projects
            .AsNoTracking()
            .Include(p => p.ThumbnailAsset)
            .FirstOrDefaultAsync(
                p => p.Id == share.ProjectId && p.DeletedAt == null, cancellationToken);
        if (project is null) return NotFound();

        var scene = await LoadSceneAsync(project.Id, cancellationToken);
        return Ok(new SharedProjectDto(
            ProjectId: project.Id,
            Name: project.Name,
            ThumbnailUrl: project.ThumbnailAsset?.Url,
            Mode: share.Mode,
            Scene: scene));
    }

    [HttpGet("{token}/comments")]
    public async Task<ActionResult<IReadOnlyList<CommentDto>>> ListComments(
        string token,
        CancellationToken cancellationToken)
    {
        var share = await ResolveShareAsync(token, cancellationToken);
        if (share is null) return NotFound();

        var rows = await _db.ProjectComments
            .AsNoTracking()
            .Where(c => c.ProjectId == share.ProjectId && c.DeletedAt == null)
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
            ProjectsController.ParseAnchor(r.Anchor),
            r.CreatedAt,
            r.ResolvedAt
        )).ToList();

        return Ok(dtos);
    }

    [HttpPost("{token}/comments")]
    public async Task<ActionResult<CommentDto>> PostComment(
        string token,
        PostCommentRequest request,
        CancellationToken cancellationToken)
    {
        var share = await ResolveShareAsync(token, cancellationToken);
        if (share is null) return NotFound();
        if (share.Mode != ShareMode.Comment)
        {
            return Problem(
                "This share is view-only.",
                statusCode: StatusCodes.Status403Forbidden);
        }

        if (string.IsNullOrWhiteSpace(request.Body))
        {
            return Problem("Body is required.", statusCode: StatusCodes.Status400BadRequest);
        }

        // Resolve the caller: bearer if present and valid, otherwise anon with
        // a required guest name. We don't error on a bearer that fails to parse
        // — just fall back to anon.
        var authorUserId = TryGetSignedInUserId();
        string? guestName = null;
        string? guestEmail = null;
        if (authorUserId is null)
        {
            if (string.IsNullOrWhiteSpace(request.GuestName))
            {
                return Problem(
                    "guestName is required for anonymous comments.",
                    statusCode: StatusCodes.Status400BadRequest);
            }
            guestName = request.GuestName.Trim();
            guestEmail = string.IsNullOrWhiteSpace(request.GuestEmail)
                ? null
                : request.GuestEmail.Trim().ToLowerInvariant();
        }

        if (request.ParentCommentId is { } parentId)
        {
            var parentExists = await _db.ProjectComments.AnyAsync(
                c => c.Id == parentId && c.ProjectId == share.ProjectId, cancellationToken);
            if (!parentExists)
            {
                return Problem("Parent comment not found.",
                    statusCode: StatusCodes.Status400BadRequest);
            }
        }

        var anchorJson = request.Anchor is null
            ? null
            : JsonSerializer.Serialize(request.Anchor.Value, JsonOpts);

        var comment = new ProjectComment
        {
            Id = Guid.NewGuid(),
            ProjectId = share.ProjectId,
            ParentCommentId = request.ParentCommentId,
            AuthorUserId = authorUserId,
            GuestName = guestName,
            GuestEmail = guestEmail,
            ShareId = share.Id,
            Body = request.Body.Trim(),
            Anchor = anchorJson,
            CreatedAt = DateTime.UtcNow
        };
        _db.ProjectComments.Add(comment);
        await _db.SaveChangesAsync(cancellationToken);

        string? displayName = null;
        if (authorUserId is { } uid)
        {
            displayName = await _db.Users
                .AsNoTracking()
                .Where(u => u.Id == uid)
                .Select(u => u.DisplayName)
                .FirstOrDefaultAsync(cancellationToken);
        }

        return StatusCode(StatusCodes.Status201Created, new CommentDto(
            comment.Id,
            comment.ParentCommentId,
            comment.AuthorUserId,
            displayName,
            comment.GuestName,
            comment.Body,
            ProjectsController.ParseAnchor(comment.Anchor),
            comment.CreatedAt,
            comment.ResolvedAt));
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private async Task<ProjectShare?> ResolveShareAsync(string token, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        var now = DateTime.UtcNow;
        return await _db.ProjectShares
            .AsNoTracking()
            .FirstOrDefaultAsync(
                s => s.Token == token
                    && s.RevokedAt == null
                    && (s.ExpiresAt == null || s.ExpiresAt > now),
                cancellationToken);
    }

    private Guid? TryGetSignedInUserId()
    {
        // The endpoint is [AllowAnonymous], but a valid bearer still populates
        // User. Treat absence as "guest", not "error".
        var raw = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(raw, out var id) ? id : null;
    }

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
}
