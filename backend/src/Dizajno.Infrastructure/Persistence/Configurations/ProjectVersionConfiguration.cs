using Dizajno.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dizajno.Infrastructure.Persistence.Configurations;

public sealed class ProjectVersionConfiguration : IEntityTypeConfiguration<ProjectVersion>
{
    public void Configure(EntityTypeBuilder<ProjectVersion> b)
    {
        b.HasKey(x => x.Id);
        b.Property(x => x.Label).HasMaxLength(200).IsRequired();
        b.Property(x => x.SceneSnapshot).HasColumnType("jsonb").IsRequired();
        b.Property(x => x.CreatedAt).HasDefaultValueSql("now()");

        b.HasIndex(x => new { x.ProjectId, x.CreatedAt });

        b.HasOne(x => x.Project)
            .WithMany(p => p.Versions)
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
