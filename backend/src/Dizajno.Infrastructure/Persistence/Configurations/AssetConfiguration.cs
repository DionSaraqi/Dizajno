using Dizajno.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dizajno.Infrastructure.Persistence.Configurations;

public sealed class AssetConfiguration : IEntityTypeConfiguration<Asset>
{
    public void Configure(EntityTypeBuilder<Asset> b)
    {
        b.HasKey(x => x.Id);
        b.Property(x => x.Kind).HasConversion<string>().HasMaxLength(32);
        b.Property(x => x.Url).HasMaxLength(1000).IsRequired();
        b.Property(x => x.MimeType).HasMaxLength(120).IsRequired();
        b.Property(x => x.ChecksumSha256).HasMaxLength(64);
        b.Property(x => x.CreatedAt).HasDefaultValueSql("now()");

        b.HasIndex(x => x.ProductId);
        b.HasIndex(x => x.VariantId);
        b.HasIndex(x => x.OwnerSupplierId);

        b.HasOne(x => x.Product)
            .WithMany()
            .HasForeignKey(x => x.ProductId)
            .OnDelete(DeleteBehavior.SetNull);

        b.HasOne(x => x.Variant)
            .WithMany()
            .HasForeignKey(x => x.VariantId)
            .OnDelete(DeleteBehavior.SetNull);

        b.HasOne(x => x.OwnerSupplier)
            .WithMany()
            .HasForeignKey(x => x.OwnerSupplierId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
