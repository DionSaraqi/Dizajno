using Dizajno.Application.Auth;
using Dizajno.Application.Seed;
using Dizajno.Application.Storage;
using Dizajno.Application.Suppliers;
using Dizajno.Infrastructure.Auth;
using Dizajno.Infrastructure.Identity;
using Dizajno.Infrastructure.Persistence;
using Dizajno.Infrastructure.Persistence.Seed;
using Dizajno.Infrastructure.Storage;
using Dizajno.Infrastructure.Suppliers;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Dizajno.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        // Resolve the connection string from IConfiguration at DbContext construction
        // time rather than capturing it at startup. This way, configuration providers
        // injected later (e.g. WebApplicationFactory overrides in integration tests)
        // are honoured uniformly.
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

        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddScoped<IDataSeeder, DataSeeder>();
        services.AddScoped<ISupplierMembershipResolver, SupplierMembershipResolver>();
        services.AddSingleton<IObjectStorage, S3ObjectStorage>();

        return services;
    }
}
