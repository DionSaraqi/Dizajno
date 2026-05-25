using Dizajno.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dizajno.Data.Configurations;

public sealed class SupplierMemberConfiguration : IEntityTypeConfiguration<SupplierMember>
{
    public void Configure(EntityTypeBuilder<SupplierMember> b)
    {
        b.HasKey(x => x.Id);
        b.Property(x => x.Role).HasConversion<string>().HasMaxLength(32);
        b.Property(x => x.CreatedAt).HasDefaultValueSql("now()");

        b.HasIndex(x => new { x.SupplierId, x.UserId }).IsUnique();

        b.HasOne(x => x.Supplier)
            .WithMany(s => s.Members)
            .HasForeignKey(x => x.SupplierId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
