using Dizajno.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dizajno.Infrastructure.Persistence.Configurations;

public sealed class SupplierTextureConfiguration : IEntityTypeConfiguration<SupplierTexture>
{
    public void Configure(EntityTypeBuilder<SupplierTexture> b)
    {
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.Tags).HasColumnType("text[]").IsRequired();
        b.Property(x => x.RepeatU).HasDefaultValue(4);
        b.Property(x => x.RepeatV).HasDefaultValue(4);
        b.Property(x => x.CreatedAt).HasDefaultValueSql("now()");

        b.HasIndex(x => new { x.SupplierId, x.Name }).IsUnique();

        b.HasOne(x => x.Supplier)
            .WithMany(s => s.Textures)
            .HasForeignKey(x => x.SupplierId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(x => x.Asset)
            .WithMany()
            .HasForeignKey(x => x.AssetId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(x => x.ThumbnailAsset)
            .WithMany()
            .HasForeignKey(x => x.ThumbnailAssetId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
