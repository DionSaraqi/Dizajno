using Dizajno.Domain.Enums;

namespace Dizajno.Dto.Quote;

public sealed record QuoteRequestDto(
    Guid Id,
    Guid SupplierId,
    string SupplierSlug,
    string SupplierName,
    QuoteRequestStatus Status,
    DateTime? ExpiresAt,
    DateTime CreatedAt,
    IReadOnlyList<QuoteLineDto> Lines,
    QuoteResponseDto? Response);
