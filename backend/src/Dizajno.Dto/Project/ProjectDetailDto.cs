namespace Dizajno.Dto.Project;

public sealed record ProjectDetailDto(
    Guid Id,
    string Name,
    string? ThumbnailUrl,
    Guid? ThumbnailAssetId,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    SceneDto Scene,
    IReadOnlyList<ProjectVersionSummaryDto> Versions);
