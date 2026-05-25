namespace Dizajno.Dto.Quote;

public sealed record ManualQuoteLineRequest(
    Guid ProductVariantId,
    decimal Quantity,
    string QuantityUnit);
