using Dizajno.Domain.Enums;

namespace Dizajno.Dto.Quote;

public sealed record QuoteDetailDto(
    Guid Id,
    Guid ProjectId,
    string ProjectName,
    string? ProjectThumbnailUrl,
    Guid RequesterUserId,
    QuoteStatus Status,
    string? Message,
    DateTime CreatedAt,
    DateTime? ClosedAt,
    IReadOnlyList<QuoteRequestDto> Requests);
