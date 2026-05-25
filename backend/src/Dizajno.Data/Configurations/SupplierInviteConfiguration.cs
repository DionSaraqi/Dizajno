using Dizajno.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dizajno.Data.Configurations;

public sealed class SupplierInviteConfiguration : IEntityTypeConfiguration<SupplierInvite>
{
    public void Configure(EntityTypeBuilder<SupplierInvite> b)
    {
        b.HasKey(x => x.Id);
        b.Property(x => x.Role).HasConversion<string>().HasMaxLength(16);
        b.Property(x => x.InvitedEmail).HasMaxLength(320).IsRequired();
        b.Property(x => x.TokenHash).HasMaxLength(128).IsRequired();
        b.Property(x => x.CreatedAt).HasDefaultValueSql("now()");

        b.HasIndex(x => x.TokenHash).IsUnique();
        b.HasIndex(x => new { x.SupplierId, x.AcceptedAt, x.RevokedAt });

        b.HasOne(x => x.Supplier)
            .WithMany(s => s.Invites)
            .HasForeignKey(x => x.SupplierId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
