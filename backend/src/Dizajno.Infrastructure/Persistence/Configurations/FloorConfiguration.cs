using Dizajno.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dizajno.Infrastructure.Persistence.Configurations;

public sealed class FloorConfiguration : IEntityTypeConfiguration<Floor>
{
    public void Configure(EntityTypeBuilder<Floor> b)
    {
        b.HasKey(x => x.Id);
        b.Property(x => x.Vertices).HasColumnType("jsonb").IsRequired();

        b.HasIndex(x => x.ProjectId);

        b.HasOne(x => x.Project)
            .WithMany(p => p.Floors)
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
