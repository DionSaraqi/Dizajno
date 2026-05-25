namespace Dizajno.Dto.Quote;

public sealed record QuoteLineDto(
    Guid Id,
    Guid ProductVariantId,
    System.Text.Json.JsonElement VariantSnapshot,
    decimal Quantity,
    string QuantityUnit,
    Dictionary<string, object>? MaterialOverrides,
    decimal? ScaledWidth,
    decimal? ScaledDepth,
    decimal? ScaledHeight,
    bool IsCustomSize,
    decimal? SuggestedPrice,
    string Currency);
