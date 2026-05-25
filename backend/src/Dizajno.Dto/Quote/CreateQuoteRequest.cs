namespace Dizajno.Dto.Quote;

/// <summary>
/// Phase 6 grew <see cref="ManualLines"/> for catalog items that aren't placed in
/// the scene (paint, flooring) — the dialog computes a quantity from room geometry
/// and submits the resulting list alongside the project's placed items + branded
/// openings. Each manual line is validated against a real Published variant before
/// being inserted as a <see cref="Dizajno.Domain.Entities.QuoteLine"/>.
/// </summary>
public sealed record CreateQuoteRequest(
    string? Message,
    IReadOnlyList<ManualQuoteLineRequest>? ManualLines = null);
