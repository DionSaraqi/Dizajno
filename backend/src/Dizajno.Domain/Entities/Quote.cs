using Dizajno.Domain.Enums;

namespace Dizajno.Domain.Entities;

/// <summary>
/// User-facing parent of a quote request. The user issues one Quote per
/// "I want to know what this room costs" action; the backend fans the placed
/// items out into one <see cref="QuoteRequest"/> per supplier.
/// </summary>
public sealed class Quote
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public Guid RequesterUserId { get; set; }
    public QuoteStatus Status { get; set; } = QuoteStatus.Open;
    public string? Message { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ClosedAt { get; set; }

    public Project Project { get; set; } = null!;
    public ICollection<QuoteRequest> Requests { get; set; } = new List<QuoteRequest>();
}
