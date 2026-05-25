using Dizajno.Application.Seed;
using Dizajno.Data.Identity;
using Dizajno.Data.Seed;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Dizajno.Data;

public static class DependencyInjection
{
    public static IServiceCollection AddData(this IServiceCollection services)
    {
        services.AddDbContext<DizajnoDbContext>((sp, options) =>
        {
            var configuration = sp.GetRequiredService<IConfiguration>();
            var connectionString = configuration.GetConnectionString("Dizajno")
                ?? throw new InvalidOperationException(
                    "ConnectionStrings:Dizajno is not configured. Set it in appsettings.Development.json " +
                    "or via the DIZAJNO_ConnectionStrings__Dizajno environment variable.");
            options.UseNpgsql(connectionString)
                .UseSnakeCaseNamingConvention();
        });

        services
            .AddIdentityCore<ApplicationUser>(options =>
            {
                options.Password.RequiredLength = 8;
                options.Password.RequireDigit = true;
                options.Password.RequireUppercase = true;
                options.Password.RequireNonAlphanumeric = false;
                options.User.RequireUniqueEmail = true;
            })
            .AddRoles<IdentityRole<Guid>>()
            .AddRoleManager<RoleManager<IdentityRole<Guid>>>()
            .AddEntityFrameworkStores<DizajnoDbContext>()
            .AddDefaultTokenProviders();

        services.AddScoped<IDataSeeder, DataSeeder>();

        return services;
    }
}
