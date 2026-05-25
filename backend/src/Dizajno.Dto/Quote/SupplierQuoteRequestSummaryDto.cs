using Dizajno.Domain.Enums;

namespace Dizajno.Dto.Quote;

public sealed record SupplierQuoteRequestSummaryDto(
    Guid Id,
    Guid QuoteId,
    Guid SupplierId,
    string SupplierName,
    QuoteRequestStatus Status,
    DateTime CreatedAt,
    DateTime? ExpiresAt,
    Guid ProjectId,
    string ProjectName,
    string? ProjectThumbnailUrl,
    string RequesterDisplayName,
    int LineCount,
    bool HasResponse);
