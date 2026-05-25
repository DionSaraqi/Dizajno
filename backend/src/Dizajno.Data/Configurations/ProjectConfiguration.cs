using Dizajno.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dizajno.Data.Configurations;

public sealed class ProjectConfiguration : IEntityTypeConfiguration<Project>
{
    public void Configure(EntityTypeBuilder<Project> b)
    {
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
        b.Property(x => x.UpdatedAt).HasDefaultValueSql("now()");

        // Most-listed query is "this user's non-deleted projects, most recent first".
        b.HasIndex(x => new { x.OwnerUserId, x.DeletedAt, x.UpdatedAt });

        b.HasOne(x => x.ThumbnailAsset)
            .WithMany()
            .HasForeignKey(x => x.ThumbnailAssetId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
