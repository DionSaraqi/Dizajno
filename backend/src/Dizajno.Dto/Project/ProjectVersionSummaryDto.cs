namespace Dizajno.Dto.Project;

public sealed record ProjectVersionSummaryDto(
    Guid Id,
    string Label,
    Guid CreatedByUserId,
    DateTime CreatedAt);
