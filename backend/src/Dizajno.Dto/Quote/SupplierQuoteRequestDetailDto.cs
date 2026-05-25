using Dizajno.Domain.Enums;

namespace Dizajno.Dto.Quote;

public sealed record SupplierQuoteRequestDetailDto(
    Guid Id,
    Guid QuoteId,
    Guid SupplierId,
    string SupplierName,
    QuoteRequestStatus Status,
    QuoteStatus QuoteStatus,
    DateTime CreatedAt,
    DateTime? ExpiresAt,
    Guid ProjectId,
    string ProjectName,
    string? ProjectThumbnailUrl,
    string RequesterDisplayName,
    string? Message,
    IReadOnlyList<QuoteLineDto> Lines,
    QuoteResponseDto? Response);
