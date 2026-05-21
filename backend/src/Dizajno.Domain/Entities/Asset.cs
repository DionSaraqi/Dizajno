using Dizajno.Domain.Enums;

namespace Dizajno.Domain.Entities;

public sealed class Asset
{
    public Guid Id { get; set; }
    public Guid? ProductId { get; set; }
    public Guid? VariantId { get; set; }
    public Guid? OwnerSupplierId { get; set; }
    public AssetKind Kind { get; set; }
    public string Url { get; set; } = string.Empty;
    public string MimeType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string? ChecksumSha256 { get; set; }
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }

    public Product? Product { get; set; }
    public ProductVariant? Variant { get; set; }
    public Supplier? OwnerSupplier { get; set; }
}
