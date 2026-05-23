namespace Dizajno.Domain.Entities;

/// <summary>
/// A single line item inside a <see cref="QuoteRequest"/>. Mirrors one
/// placed item from the project's scene at the moment the quote was sent.
/// <see cref="VariantSnapshot"/> is the canonical record of what the supplier
/// is being asked to quote — the FK to <see cref="ProductVariant"/> stays so
/// the supplier can drill into the current catalog state, but the snapshot
/// keeps the line meaningful even if catalog rows change.
/// </summary>
public sealed class QuoteLine
{
    public Guid Id { get; set; }
    public Guid QuoteRequestId { get; set; }
    public Guid ProductVariantId { get; set; }
    /// <summary>
    /// jsonb snapshot of the variant + product at fan-out time. Shape:
    /// { variantId, sku, name, supplierId, supplierName, productSlug, productName,
    ///   family, stockWidth, stockDepth, stockHeight, currency, basePrice }.
    /// </summary>
    public string VariantSnapshot { get; set; } = "{}";
    public decimal Quantity { get; set; } = 1m;
    public string QuantityUnit { get; set; } = "piece";
    /// <summary>jsonb { materialColors?, materialTextures? } copied from the placed item.</summary>
    public string? MaterialOverrides { get; set; }
    public decimal? ScaledWidth { get; set; }
    public decimal? ScaledDepth { get; set; }
    public decimal? ScaledHeight { get; set; }
    /// <summary>
    /// Server-set at insert: true when any scaled_* differs from the stock dimension
    /// in <see cref="VariantSnapshot"/> by more than 1 mm.
    /// </summary>
    public bool IsCustomSize { get; set; }
    public decimal? SuggestedPrice { get; set; }
    public string Currency { get; set; } = "EUR";

    public QuoteRequest QuoteRequest { get; set; } = null!;
    public ProductVariant ProductVariant { get; set; } = null!;
}
