using Dizajno.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dizajno.Infrastructure.Persistence.Configurations;

public sealed class QuoteResponseAssetConfiguration : IEntityTypeConfiguration<QuoteResponseAsset>
{
    public void Configure(EntityTypeBuilder<QuoteResponseAsset> b)
    {
        b.HasKey(x => x.Id);

        b.HasIndex(x => new { x.ResponseId, x.SortOrder });

        b.HasOne(x => x.Response)
            .WithMany(r => r.Attachments)
            .HasForeignKey(x => x.ResponseId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(x => x.Asset)
            .WithMany()
            .HasForeignKey(x => x.AssetId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
