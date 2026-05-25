using Microsoft.Extensions.DependencyInjection;

namespace Dizajno.Application;

public static class DependencyInjection
{
    /// <summary>
    /// Registers the Application-layer business services. The plumbing interfaces
    /// (IJwtTokenService, IObjectStorage, IAuditLogger, ISupplierMembershipResolver)
    /// are still bound in <c>AddInfrastructure()</c> since their implementations live
    /// in <c>Dizajno.Infrastructure</c>; <c>AddApplication()</c> registers only the
    /// business-logic services lifted out of the controllers.
    /// </summary>
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        // Phase 4b will populate this with per-area services
        // (IAuthService, ICatalogService, IProjectService, IQuoteService, ...).
        return services;
    }
}
