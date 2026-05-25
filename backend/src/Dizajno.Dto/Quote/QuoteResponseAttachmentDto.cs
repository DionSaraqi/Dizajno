namespace Dizajno.Dto.Quote;

public sealed record QuoteResponseAttachmentDto(
    Guid Id,
    Guid AssetId,
    string Url,
    string MimeType,
    long SizeBytes,
    int SortOrder);
