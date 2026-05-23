using Dizajno.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dizajno.Infrastructure.Persistence.Configurations;

public sealed class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> b)
    {
        b.HasKey(x => x.Id);
        b.Property(x => x.Family).HasConversion<string>().HasMaxLength(32);
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(32);
        b.Property(x => x.UnitOfSale).HasConversion<string>().HasMaxLength(32);
        b.Property(x => x.Slug).HasMaxLength(160).IsRequired();
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.PreviewSvg).HasColumnType("text");
        b.Property(x => x.TextureUrl).HasMaxLength(500);
        b.Property(x => x.CoverageRate).HasColumnType("numeric(10,3)");
        b.Property(x => x.WasteFactor).HasColumnType("numeric(5,3)");
        b.Property(x => x.Attributes).HasColumnType("jsonb").IsRequired();
        b.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
        b.Property(x => x.UpdatedAt).HasDefaultValueSql("now()");

        b.HasIndex(x => x.Slug).IsUnique();
        b.HasIndex(x => new { x.Status, x.Family, x.CategoryId });
        b.HasIndex(x => new { x.SupplierId, x.Status });

        b.HasOne(x => x.Supplier)
            .WithMany(s => s.Products)
            .HasForeignKey(x => x.SupplierId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(x => x.Category)
            .WithMany()
            .HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
