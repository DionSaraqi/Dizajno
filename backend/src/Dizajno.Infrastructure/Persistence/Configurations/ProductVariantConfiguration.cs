using Dizajno.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dizajno.Infrastructure.Persistence.Configurations;

public sealed class ProductVariantConfiguration : IEntityTypeConfiguration<ProductVariant>
{
    public void Configure(EntityTypeBuilder<ProductVariant> b)
    {
        b.HasKey(x => x.Id);
        b.Property(x => x.Sku).HasMaxLength(120).IsRequired();
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.Width).HasColumnType("numeric(8,3)");
        b.Property(x => x.Depth).HasColumnType("numeric(8,3)");
        b.Property(x => x.Height).HasColumnType("numeric(8,3)");
        b.Property(x => x.Color).HasMaxLength(16).IsRequired();
        b.Property(x => x.BasePrice).HasColumnType("numeric(12,2)");
        b.Property(x => x.Currency).HasMaxLength(3).IsRequired();
        b.Property(x => x.CollisionBoxes).HasColumnType("jsonb");
        b.Property(x => x.MaterialDefaults).HasColumnType("jsonb");
        b.Property(x => x.Attributes).HasColumnType("jsonb").IsRequired();
        b.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
        b.Property(x => x.UpdatedAt).HasDefaultValueSql("now()");

        b.HasIndex(x => new { x.ProductId, x.SortOrder });
        b.HasIndex(x => x.Sku).IsUnique();

        b.HasOne(x => x.Product)
            .WithMany(p => p.Variants)
            .HasForeignKey(x => x.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(x => x.GlbAsset)
            .WithMany()
            .HasForeignKey(x => x.GlbAssetId)
            .OnDelete(DeleteBehavior.SetNull);

        b.HasOne(x => x.SvgPreviewAsset)
            .WithMany()
            .HasForeignKey(x => x.SvgPreviewAssetId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
