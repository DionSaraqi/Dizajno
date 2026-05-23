using Dizajno.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dizajno.Infrastructure.Persistence.Configurations;

public sealed class AuditLogEntryConfiguration : IEntityTypeConfiguration<AuditLogEntry>
{
    public void Configure(EntityTypeBuilder<AuditLogEntry> b)
    {
        b.ToTable("audit_log");

        b.HasKey(x => x.Id);
        b.Property(x => x.Action).HasMaxLength(64).IsRequired();
        b.Property(x => x.EntityType).HasMaxLength(64).IsRequired();
        b.Property(x => x.IpAddress).HasMaxLength(64);
        b.Property(x => x.Diff).HasColumnType("jsonb");
        b.Property(x => x.CreatedAt).HasDefaultValueSql("now()");

        b.HasIndex(x => new { x.EntityType, x.EntityId, x.CreatedAt })
            .IsDescending(false, false, true);
        b.HasIndex(x => new { x.ActorUserId, x.CreatedAt })
            .IsDescending(false, true);
        b.HasIndex(x => new { x.Action, x.CreatedAt })
            .IsDescending(false, true);
    }
}
