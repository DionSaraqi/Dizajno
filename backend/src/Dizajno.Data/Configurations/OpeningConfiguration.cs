using Dizajno.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dizajno.Data.Configurations;

public sealed class OpeningConfiguration : IEntityTypeConfiguration<Opening>
{
    public void Configure(EntityTypeBuilder<Opening> b)
    {
        b.HasKey(x => x.Id);
        b.Property(x => x.Type).HasConversion<string>().HasMaxLength(16);
        b.Property(x => x.OffsetFromStart).HasColumnType("numeric(10,4)");
        b.Property(x => x.Width).HasColumnType("numeric(6,3)");
        b.Property(x => x.Height).HasColumnType("numeric(6,3)");
        b.Property(x => x.SillHeight).HasColumnType("numeric(6,3)");
        b.Property(x => x.MaterialOverrides).HasColumnType("jsonb");

        b.HasIndex(x => x.ProjectId);
        b.HasIndex(x => x.WallId);

        b.HasOne(x => x.Project)
            .WithMany(p => p.Openings)
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(x => x.Wall)
            .WithMany()
            .HasForeignKey(x => x.WallId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(x => x.ProductVariant)
            .WithMany()
            .HasForeignKey(x => x.ProductVariantId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
