using Dizajno.Domain.Entities;
using Dizajno.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dizajno.Infrastructure.Persistence.Configurations;

public sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> b)
    {
        b.HasKey(x => x.Id);
        b.Property(x => x.Family).HasConversion<string>().HasMaxLength(32);
        b.Property(x => x.Slug).HasMaxLength(120).IsRequired();
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.Path).HasMaxLength(500).IsRequired();
        // HasSentinel is the value EF treats as "use the DB default". Pending
        // is the CLR default for the enum, so without an explicit sentinel EF
        // would never persist a Pending row — supplier-suggested categories
        // would silently flip to Approved on insert.
        b.Property(x => x.Status)
            .HasConversion<string>()
            .HasMaxLength(16)
            .HasDefaultValue(CategoryStatus.Approved)
            .HasSentinel(CategoryStatus.Approved);

        b.HasIndex(x => new { x.Family, x.Slug }).IsUnique();
        b.HasIndex(x => x.Path);
        b.HasIndex(x => x.Status);

        b.HasOne(x => x.ParentCategory)
            .WithMany(x => x.Children)
            .HasForeignKey(x => x.ParentCategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        // suggested_by_supplier_id links a supplier-suggested category back
        // to the supplier that proposed it (drives "Suggested by Acme" in
        // the admin moderation queue). No nav property — admin controllers
        // join when they need the supplier name.
        b.HasOne<Supplier>()
            .WithMany()
            .HasForeignKey(x => x.SuggestedBySupplierId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
