using System.Security.Claims;
using System.Text.Json;
using Dizajno.Application.Interfaces;
using Dizajno.Data;
using Dizajno.Domain.Entities;
using Dizajno.Domain.Enums;
using Dizajno.Dto.Project;
using Dizajno.Dto.Share;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dizajno.Application.Services;

public sealed class SharedProjectService : ISharedProjectService
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    private readonly DizajnoDbContext _db;

    public SharedProjectService(DizajnoDbContext db) => _db = db;

    public async Task<ActionResult<SharedProjectDto>> LoadAsync(
        string token,
        CancellationToken cancellationToken)
    {
        var share = await ResolveShareAsync(token, cancellationToken);
        if (share is null) return new NotFoundResult();

        var project = await _db.Projects
            .AsNoTracking()
            .Include(p => p.ThumbnailAsset)
            .FirstOrDefaultAsync(
                p => p.Id == share.ProjectId && p.DeletedAt == null, cancellationToken);
        if (project is null) return new NotFoundResult();

        var scene = await LoadSceneAsync(project.Id, cancellationToken);
        return new OkObjectResult(new SharedProjectDto(
            ProjectId: project.Id,
            Name: project.Name,
            ThumbnailUrl: project.ThumbnailAsset?.Url,
            Mode: share.Mode,
            Scene: scene));
    }

    public async Task<ActionResult<IReadOnlyList<CommentDto>>> ListCommentsAsync(
        string token,
        CancellationToken cancellationToken)
    {
        var share = await ResolveShareAsync(token, cancellationToken);
        if (share is null) return new NotFoundResult();

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
            AnchorParser.Parse(r.Anchor),
            r.CreatedAt,
            r.ResolvedAt
        )).ToList();

        return new OkObjectResult(dtos);
    }

    public async Task<ActionResult<CommentDto>> PostCommentAsync(
        string token,
        PostCommentRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        var share = await ResolveShareAsync(token, cancellationToken);
        if (share is null) return new NotFoundResult();
        if (share.Mode != ShareMode.Comment)
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = "This share is view-only.",
                Status = StatusCodes.Status403Forbidden,
                Title = "Forbidden"
            })
            { StatusCode = StatusCodes.Status403Forbidden };
        }

        if (string.IsNullOrWhiteSpace(request.Body))
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = "Body is required.",
                Status = StatusCodes.Status400BadRequest,
                Title = "Bad Request"
            })
            { StatusCode = StatusCodes.Status400BadRequest };
        }

        // Resolve the caller: bearer if present and valid, otherwise anon with
        // a required guest name. We don't error on a bearer that fails to parse
        // â€” just fall back to anon.
        var authorUserId = TryGetSignedInUserId(user);
        string? guestName = null;
        string? guestEmail = null;
        if (authorUserId is null)
        {
            if (string.IsNullOrWhiteSpace(request.GuestName))
            {
                return new ObjectResult(new ProblemDetails
                {
                    Detail = "guestName is required for anonymous comments.",
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Bad Request"
                })
                { StatusCode = StatusCodes.Status400BadRequest };
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
                return new ObjectResult(new ProblemDetails
                {
                    Detail = "Parent comment not found.",
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Bad Request"
                })
                { StatusCode = StatusCodes.Status400BadRequest };
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

        return new ObjectResult(new CommentDto(
            comment.Id,
            comment.ParentCommentId,
            comment.AuthorUserId,
            displayName,
            comment.GuestName,
            comment.Body,
            AnchorParser.Parse(comment.Anchor),
            comment.CreatedAt,
            comment.ResolvedAt))
        { StatusCode = StatusCodes.Status201Created };
    }

    // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

    private static Guid? TryGetSignedInUserId(ClaimsPrincipal user)
    {
        // The endpoint is [AllowAnonymous], but a valid bearer still populates
        // User. Treat absence as "guest", not "error".
        var raw = user.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            ?? user.FindFirst("sub")?.Value;
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
