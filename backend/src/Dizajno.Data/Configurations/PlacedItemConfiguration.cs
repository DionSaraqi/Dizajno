using Dizajno.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dizajno.Data.Configurations;

public sealed class PlacedItemConfiguration : IEntityTypeConfiguration<PlacedItem>
{
    public void Configure(EntityTypeBuilder<PlacedItem> b)
    {
        b.HasKey(x => x.Id);
        b.Property(x => x.PositionX).HasColumnType("numeric(10,4)");
        b.Property(x => x.PositionZ).HasColumnType("numeric(10,4)");
        b.Property(x => x.Rotation).HasColumnType("numeric(8,5)");
        b.Property(x => x.Elevation).HasColumnType("numeric(10,4)").HasDefaultValue(0m);
        b.Property(x => x.Scale).HasColumnType("numeric(5,3)").HasDefaultValue(1m);
        b.Property(x => x.ScaledWidth).HasColumnType("numeric(8,3)");
        b.Property(x => x.ScaledDepth).HasColumnType("numeric(8,3)");
        b.Property(x => x.ScaledHeight).HasColumnType("numeric(8,3)");
        b.Property(x => x.MaterialColors).HasColumnType("jsonb");
        b.Property(x => x.MaterialTextures).HasColumnType("jsonb");
        b.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
        b.Property(x => x.UpdatedAt).HasDefaultValueSql("now()");

        b.HasIndex(x => x.ProjectId);
        b.HasIndex(x => x.ProductVariantId);

        b.HasOne(x => x.Project)
            .WithMany(p => p.PlacedItems)
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(x => x.ProductVariant)
            .WithMany()
            .HasForeignKey(x => x.ProductVariantId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
