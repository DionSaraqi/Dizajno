using Dizajno.Domain.Entities;
using Dizajno.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
// Note: RefreshToken lives in the Identity namespace alongside ApplicationUser.

namespace Dizajno.Infrastructure.Persistence;

public sealed class DizajnoDbContext : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>
{
    public DizajnoDbContext(DbContextOptions<DizajnoDbContext> options) : base(options)
    {
    }

    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<SupplierMember> SupplierMembers => Set<SupplierMember>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();
    public DbSet<Asset> Assets => Set<Asset>();
    public DbSet<Translation> Translations => Set<Translation>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<ProjectVersion> ProjectVersions => Set<ProjectVersion>();
    public DbSet<Wall> Walls => Set<Wall>();
    public DbSet<Floor> Floors => Set<Floor>();
    public DbSet<Opening> Openings => Set<Opening>();
    public DbSet<PlacedItem> PlacedItems => Set<PlacedItem>();
    public DbSet<ProjectShare> ProjectShares => Set<ProjectShare>();
    public DbSet<ProjectComment> ProjectComments => Set<ProjectComment>();
    public DbSet<SupplierTexture> SupplierTextures => Set<SupplierTexture>();
    public DbSet<ProductVariantTextureSlot> ProductVariantTextureSlots => Set<ProductVariantTextureSlot>();
    public DbSet<Quote> Quotes => Set<Quote>();
    public DbSet<QuoteRequest> QuoteRequests => Set<QuoteRequest>();
    public DbSet<QuoteLine> QuoteLines => Set<QuoteLine>();
    public DbSet<QuoteResponse> QuoteResponses => Set<QuoteResponse>();
    public DbSet<QuoteResponseAsset> QuoteResponseAssets => Set<QuoteResponseAsset>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(DizajnoDbContext).Assembly);
    }
}
