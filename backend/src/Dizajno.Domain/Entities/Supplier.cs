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
    /// <summary>
    /// When true, new products from this supplier publish immediately. When
    /// false, new products land in <see cref="Enums.ProductStatus.Pending"/>
    /// awaiting admin approval. Admin-flippable.
    /// </summary>
    public bool IsTrusted { get; set; }
    /// <summary>
    /// Set when an admin suspends this supplier. Suspended suppliers' products
    /// are hidden from the public catalog, members can't access the supplier
    /// portal, and the quote fan-out skips them. Null = active.
    /// </summary>
    public DateTime? SuspendedAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public Asset? LogoAsset { get; set; }
    public ICollection<Product> Products { get; set; } = new List<Product>();
    public ICollection<SupplierMember> Members { get; set; } = new List<SupplierMember>();
    public ICollection<SupplierTexture> Textures { get; set; } = new List<SupplierTexture>();
    public ICollection<SupplierInvite> Invites { get; set; } = new List<SupplierInvite>();
    /// <summary>
    /// Inverse of <see cref="Asset.OwnerSupplier"/>. Exposed mostly so EF
    /// stops inferring a 1:1 relationship between Supplier and Asset off the
    /// <see cref="LogoAsset"/> single-nav pair (which caused
    /// <c>ix_assets_owner_supplier_id</c> to be UNIQUE through migration 0009).
    /// </summary>
    public ICollection<Asset> OwnedAssets { get; set; } = new List<Asset>();
}
