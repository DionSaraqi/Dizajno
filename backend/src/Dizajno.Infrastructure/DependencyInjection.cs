using Dizajno.Application.Audit;
using Dizajno.Application.Auth;
using Dizajno.Application.Storage;
using Dizajno.Application.Suppliers;
using Dizajno.Infrastructure.Audit;
using Dizajno.Infrastructure.Auth;
using Dizajno.Infrastructure.Storage;
using Dizajno.Infrastructure.Suppliers;
using Microsoft.Extensions.DependencyInjection;

namespace Dizajno.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        services.AddHttpContextAccessor();
        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddScoped<ISupplierMembershipResolver, SupplierMembershipResolver>();
        services.AddScoped<IAuditLogger, AuditLogger>();
        services.AddSingleton<IObjectStorage, S3ObjectStorage>();

        return services;
    }
}
