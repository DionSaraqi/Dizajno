using System.Security.Claims;
using System.Text.Json;
using Dizajno.Api.Contracts;
using Dizajno.Domain.Entities;
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

    private readonly DizajnoDbContext _db;

    public ProjectsController(DizajnoDbContext db) => _db = db;

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
