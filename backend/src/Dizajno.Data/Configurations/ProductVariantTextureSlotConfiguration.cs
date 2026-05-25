using Dizajno.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dizajno.Data.Configurations;

public sealed class ProductVariantTextureSlotConfiguration : IEntityTypeConfiguration<ProductVariantTextureSlot>
{
    public void Configure(EntityTypeBuilder<ProductVariantTextureSlot> b)
    {
        b.HasKey(x => x.Id);
        b.Property(x => x.SlotName).HasMaxLength(120).IsRequired();
        b.Property(x => x.IsDefault).HasDefaultValue(false);

        b.HasIndex(x => new { x.VariantId, x.SlotName });
        b.HasIndex(x => x.SupplierTextureId);

        b.HasOne(x => x.Variant)
            .WithMany(v => v.TextureSlots)
            .HasForeignKey(x => x.VariantId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(x => x.SupplierTexture)
            .WithMany()
            .HasForeignKey(x => x.SupplierTextureId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
