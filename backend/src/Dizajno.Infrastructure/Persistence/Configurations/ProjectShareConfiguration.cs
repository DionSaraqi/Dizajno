using Dizajno.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dizajno.Infrastructure.Persistence.Configurations;

public sealed class ProjectShareConfiguration : IEntityTypeConfiguration<ProjectShare>
{
    public void Configure(EntityTypeBuilder<ProjectShare> b)
    {
        b.HasKey(x => x.Id);
        b.Property(x => x.Mode).HasConversion<string>().HasMaxLength(16);
        b.Property(x => x.Token).HasMaxLength(64);
        b.Property(x => x.InvitedEmail).HasMaxLength(320);
        b.Property(x => x.CreatedAt).HasDefaultValueSql("now()");

        b.HasIndex(x => x.Token).IsUnique();
        b.HasIndex(x => new { x.ProjectId, x.RevokedAt });

        // Exactly one of (token | invited_email | invited_user_id) must be set.
        b.ToTable(t => t.HasCheckConstraint(
            "ck_project_shares_recipient",
            "(token IS NOT NULL)::int + (invited_email IS NOT NULL)::int + (invited_user_id IS NOT NULL)::int = 1"));

        b.HasOne(x => x.Project)
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
