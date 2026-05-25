using Dizajno.Data.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dizajno.Data.Configurations;

public sealed class ApplicationUserConfiguration : IEntityTypeConfiguration<ApplicationUser>
{
    public void Configure(EntityTypeBuilder<ApplicationUser> b)
    {
        b.Property(x => x.DisplayName).HasMaxLength(200);
        b.Property(x => x.Locale).HasMaxLength(5).IsRequired();
        b.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
    }
}
