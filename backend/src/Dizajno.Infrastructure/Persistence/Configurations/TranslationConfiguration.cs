using Dizajno.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dizajno.Infrastructure.Persistence.Configurations;

public sealed class TranslationConfiguration : IEntityTypeConfiguration<Translation>
{
    public void Configure(EntityTypeBuilder<Translation> b)
    {
        b.HasKey(x => x.Id);
        b.Property(x => x.EntityType).HasMaxLength(64).IsRequired();
        b.Property(x => x.Field).HasMaxLength(64).IsRequired();
        b.Property(x => x.Lang).HasMaxLength(5).IsRequired();
        b.Property(x => x.Value).IsRequired();

        b.HasIndex(x => new { x.EntityType, x.EntityId, x.Field, x.Lang }).IsUnique();
        b.HasIndex(x => new { x.EntityType, x.EntityId, x.Lang });
    }
}
