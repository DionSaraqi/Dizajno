using Dizajno.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dizajno.Data.Configurations;

public sealed class QuoteResponseConfiguration : IEntityTypeConfiguration<QuoteResponse>
{
    public void Configure(EntityTypeBuilder<QuoteResponse> b)
    {
        b.HasKey(x => x.Id);
        b.Property(x => x.TotalPrice).HasColumnType("numeric(14,2)");
        b.Property(x => x.Currency).HasMaxLength(3).IsRequired();
        b.Property(x => x.Body).HasColumnType("text");
        b.Property(x => x.RespondedAt).HasDefaultValueSql("now()");

        b.HasIndex(x => x.QuoteRequestId).IsUnique();
    }
}
