using Dizajno.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dizajno.Data.Configurations;

public sealed class ProjectCommentConfiguration : IEntityTypeConfiguration<ProjectComment>
{
    public void Configure(EntityTypeBuilder<ProjectComment> b)
    {
        b.HasKey(x => x.Id);
        b.Property(x => x.GuestName).HasMaxLength(200);
        b.Property(x => x.GuestEmail).HasMaxLength(320);
        b.Property(x => x.Body).HasColumnType("text").IsRequired();
        b.Property(x => x.Anchor).HasColumnType("jsonb");
        b.Property(x => x.CreatedAt).HasDefaultValueSql("now()");

        b.HasIndex(x => new { x.ProjectId, x.CreatedAt });

        b.HasOne(x => x.Project)
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(x => x.ParentComment)
            .WithMany()
            .HasForeignKey(x => x.ParentCommentId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(x => x.Share)
            .WithMany()
            .HasForeignKey(x => x.ShareId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
