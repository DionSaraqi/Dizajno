using Dizajno.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dizajno.Data.Configurations;

public sealed class WallConfiguration : IEntityTypeConfiguration<Wall>
{
    public void Configure(EntityTypeBuilder<Wall> b)
    {
        b.HasKey(x => x.Id);
        b.Property(x => x.StartX).HasColumnType("numeric(10,4)");
        b.Property(x => x.StartZ).HasColumnType("numeric(10,4)");
        b.Property(x => x.EndX).HasColumnType("numeric(10,4)");
        b.Property(x => x.EndZ).HasColumnType("numeric(10,4)");
        b.Property(x => x.Thickness).HasColumnType("numeric(6,3)");
        b.Property(x => x.Height).HasColumnType("numeric(6,3)");

        b.HasIndex(x => x.ProjectId);
        b.HasIndex(x => x.PaintProductVariantId);

        b.HasOne(x => x.Project)
            .WithMany(p => p.Walls)
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(x => x.PaintProductVariant)
            .WithMany()
            .HasForeignKey(x => x.PaintProductVariantId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
