using Dizajno.Application.Interfaces;
using Dizajno.Application.Services;
using Microsoft.Extensions.DependencyInjection;

namespace Dizajno.Application;

public static class DependencyInjection
{
    /// <summary>
    /// Registers the Application-layer business services. The plumbing interfaces
    /// (IJwtTokenService, IObjectStorage, IAuditLogger, ISupplierMembershipResolver)
    /// are still bound in <c>AddInfrastructure()</c> since their implementations live
    /// in <c>Dizajno.Infrastructure</c>; <c>AddApplication()</c> registers the
    /// business-logic services lifted out of the controllers.
    /// </summary>
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<ICatalogService, CatalogService>();
        services.AddScoped<IAssetService, AssetService>();
        services.AddScoped<IInviteService, InviteService>();
        services.AddScoped<ISharedProjectService, SharedProjectService>();

        services.AddScoped<IAdminSupplierService, AdminSupplierService>();
        services.AddScoped<IAdminInviteService, AdminInviteService>();
        services.AddScoped<IAdminModerationService, AdminModerationService>();
        services.AddScoped<IAdminSupplierMemberService, AdminSupplierMemberService>();
        services.AddScoped<IAdminAuditLogService, AdminAuditLogService>();
        return services;
    }
}
