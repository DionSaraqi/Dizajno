using Dizajno.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dizajno.Infrastructure.Persistence.Configurations;

public sealed class QuoteLineConfiguration : IEntityTypeConfiguration<QuoteLine>
{
    public void Configure(EntityTypeBuilder<QuoteLine> b)
    {
        b.HasKey(x => x.Id);
        b.Property(x => x.VariantSnapshot).HasColumnType("jsonb").IsRequired();
        b.Property(x => x.Quantity).HasColumnType("numeric(12,3)").HasDefaultValue(1m);
        b.Property(x => x.QuantityUnit).HasMaxLength(16).IsRequired();
        b.Property(x => x.MaterialOverrides).HasColumnType("jsonb");
        b.Property(x => x.ScaledWidth).HasColumnType("numeric(8,3)");
        b.Property(x => x.ScaledDepth).HasColumnType("numeric(8,3)");
        b.Property(x => x.ScaledHeight).HasColumnType("numeric(8,3)");
        b.Property(x => x.SuggestedPrice).HasColumnType("numeric(12,2)");
        b.Property(x => x.Currency).HasMaxLength(3).IsRequired();

        b.HasIndex(x => x.QuoteRequestId);

        b.HasOne(x => x.QuoteRequest)
            .WithMany(r => r.Lines)
            .HasForeignKey(x => x.QuoteRequestId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(x => x.ProductVariant)
            .WithMany()
            .HasForeignKey(x => x.ProductVariantId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
