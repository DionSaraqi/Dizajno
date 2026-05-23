namespace Dizajno.Domain.Entities;

/// <summary>
/// Join row between a <see cref="QuoteResponse"/> and the supplier-uploaded
/// <see cref="Asset"/> rows attached to it (PDF quotes, drawings, …).
/// </summary>
public sealed class QuoteResponseAsset
{
    public Guid Id { get; set; }
    public Guid ResponseId { get; set; }
    public Guid AssetId { get; set; }
    public int SortOrder { get; set; }

    public QuoteResponse Response { get; set; } = null!;
    public Asset Asset { get; set; } = null!;
}
