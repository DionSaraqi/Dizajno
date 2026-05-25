namespace Dizajno.Dto.Quote;

public sealed record QuoteResponseDto(
    Guid Id,
    Guid RespondedByUserId,
    decimal TotalPrice,
    string Currency,
    string? Body,
    DateTime RespondedAt,
    IReadOnlyList<QuoteResponseAttachmentDto> Attachments);
