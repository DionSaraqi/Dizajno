using Dizajno.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dizajno.Data.Configurations;

public sealed class QuoteRequestConfiguration : IEntityTypeConfiguration<QuoteRequest>
{
    public void Configure(EntityTypeBuilder<QuoteRequest> b)
    {
        b.HasKey(x => x.Id);
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(16);
        b.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
        b.Property(x => x.CancellationReason).HasMaxLength(64);

        b.HasIndex(x => new { x.QuoteId, x.SupplierId }).IsUnique();
        b.HasIndex(x => new { x.SupplierId, x.Status, x.CreatedAt })
            .IsDescending(false, false, true);

        b.HasOne(x => x.Quote)
            .WithMany(q => q.Requests)
            .HasForeignKey(x => x.QuoteId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(x => x.Supplier)
            .WithMany()
            .HasForeignKey(x => x.SupplierId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(x => x.Response)
            .WithOne(r => r.QuoteRequest)
            .HasForeignKey<QuoteResponse>(r => r.QuoteRequestId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
