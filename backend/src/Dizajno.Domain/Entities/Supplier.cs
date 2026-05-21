namespace Dizajno.Domain.Entities;

public sealed class Supplier
{
    public Guid Id { get; set; }
    public string Slug { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid? LogoAssetId { get; set; }
    public string? WebsiteUrl { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public DateTime CreatedAt { get; set; }

    public Asset? LogoAsset { get; set; }
    public ICollection<Product> Products { get; set; } = new List<Product>();
    public ICollection<SupplierMember> Members { get; set; } = new List<SupplierMember>();
}
