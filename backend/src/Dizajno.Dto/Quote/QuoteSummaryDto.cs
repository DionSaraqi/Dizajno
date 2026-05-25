using Dizajno.Domain.Enums;

namespace Dizajno.Dto.Quote;

public sealed record QuoteSummaryDto(
    Guid Id,
    Guid ProjectId,
    string ProjectName,
    string? ProjectThumbnailUrl,
    QuoteStatus Status,
    string? Message,
    DateTime CreatedAt,
    DateTime? ClosedAt,
    int SupplierCount,
    int RespondedCount,
    int DeclinedCount);
