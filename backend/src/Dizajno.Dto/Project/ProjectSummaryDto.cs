namespace Dizajno.Dto.Project;

public sealed record ProjectSummaryDto(
    Guid Id,
    string Name,
    string? ThumbnailUrl,
    DateTime CreatedAt,
    DateTime UpdatedAt);
