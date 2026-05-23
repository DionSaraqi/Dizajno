using Dizajno.Domain.Enums;

namespace Dizajno.Domain.Entities;

/// <summary>
/// Per-supplier child of a <see cref="Quote"/>. Created at fan-out time; one
/// row per distinct supplier whose products are in the project's scene.
/// Each supplier sees only the QuoteRequest addressed to them, never sibling
/// rows under the same parent.
/// </summary>
public sealed class QuoteRequest
{
    public Guid Id { get; set; }
    public Guid QuoteId { get; set; }
    public Guid SupplierId { get; set; }
    public QuoteRequestStatus Status { get; set; } = QuoteRequestStatus.Pending;
    public DateTime? ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
    /// <summary>
    /// Free-form reason recorded alongside non-success terminal states. Today
    /// the only writer is the supplier-suspension flow, which writes
    /// <c>supplier_suspended</c> when auto-expiring still-pending requests.
    /// </summary>
    public string? CancellationReason { get; set; }

    public Quote Quote { get; set; } = null!;
    public Supplier Supplier { get; set; } = null!;
    public ICollection<QuoteLine> Lines { get; set; } = new List<QuoteLine>();
    public QuoteResponse? Response { get; set; }
}
