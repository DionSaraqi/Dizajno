using Dizajno.Domain.Enums;
using Dizajno.Dto.Project;

namespace Dizajno.Dto.Share;

public sealed record SharedProjectDto(
    Guid ProjectId,
    string Name,
    string? ThumbnailUrl,
    ShareMode Mode,
    SceneDto Scene);
