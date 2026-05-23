namespace Dizajno.Domain.Entities;

/// <summary>
/// A supplier's reply to a <see cref="QuoteRequest"/>. At most one row per
/// request — re-posting updates the existing row (an upsert) until the parent
/// <see cref="Quote"/> is closed or cancelled.
/// </summary>
public sealed class QuoteResponse
{
    public Guid Id { get; set; }
    public Guid QuoteRequestId { get; set; }
    public Guid RespondedByUserId { get; set; }
    public decimal TotalPrice { get; set; }
    public string Currency { get; set; } = "EUR";
    public string? Body { get; set; }
    public DateTime RespondedAt { get; set; }

    public QuoteRequest QuoteRequest { get; set; } = null!;
    public ICollection<QuoteResponseAsset> Attachments { get; set; } = new List<QuoteResponseAsset>();
}
