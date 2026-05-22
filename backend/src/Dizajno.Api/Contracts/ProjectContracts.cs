using Dizajno.Domain.Enums;

namespace Dizajno.Api.Contracts;

// ── Project list / create / metadata ───────────────────────────────────────

public sealed record CreateProjectRequest(string Name);

public sealed record UpdateProjectRequest(string? Name, Guid? ThumbnailAssetId);

public sealed record ProjectSummaryDto(
    Guid Id,
    string Name,
    string? ThumbnailUrl,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record ProjectDetailDto(
    Guid Id,
    string Name,
    string? ThumbnailUrl,
    Guid? ThumbnailAssetId,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    SceneDto Scene,
    IReadOnlyList<ProjectVersionSummaryDto> Versions);

// ── Scene shape ────────────────────────────────────────────────────────────

/// <summary>
/// Full editable room state. The client owns the ids — when the same scene is
/// re-saved the same uuids round-trip; new entities get fresh client-generated
/// uuids. The server performs a replace-all on PUT, so removed rows really
/// disappear.
/// </summary>
public sealed record SceneDto(
    IReadOnlyList<WallDto> Walls,
    IReadOnlyList<FloorDto> Floors,
    IReadOnlyList<OpeningDto> Openings,
    IReadOnlyList<PlacedItemDto> PlacedItems);

public sealed record WallDto(
    Guid Id,
    decimal StartX,
    decimal StartZ,
    decimal EndX,
    decimal EndZ,
    decimal Thickness,
    decimal Height);

public sealed record FloorDto(
    Guid Id,
    IReadOnlyList<IReadOnlyList<decimal>> Vertices);

public sealed record OpeningDto(
    Guid Id,
    Guid WallId,
    OpeningType Type,
    decimal OffsetFromStart,
    decimal Width,
    decimal Height,
    decimal SillHeight,
    Guid? ProductVariantId,
    Dictionary<string, string>? MaterialOverrides);

public sealed record PlacedItemDto(
    Guid Id,
    Guid ProductVariantId,
    decimal PositionX,
    decimal PositionZ,
    decimal Rotation,
    decimal Scale,
    decimal ScaledWidth,
    decimal ScaledDepth,
    decimal ScaledHeight,
    Dictionary<string, string>? MaterialColors,
    Dictionary<string, string>? MaterialTextures);

public sealed record ReplaceSceneRequest(SceneDto Scene);

// ── Versions ───────────────────────────────────────────────────────────────

public sealed record CreateVersionRequest(string Label);

public sealed record ProjectVersionSummaryDto(
    Guid Id,
    string Label,
    Guid CreatedByUserId,
    DateTime CreatedAt);
