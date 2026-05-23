namespace Dizajno.Application.Audit;

/// <summary>
/// Writes one row to the audit_log table per sensitive action. The infrastructure
/// implementation pulls the current request's actor (user id from JWT claims,
/// IP, user agent) from the ambient HttpContext via IHttpContextAccessor; outside
/// an HTTP request (background jobs, seeder) those fields are left null.
/// </summary>
public interface IAuditLogger
{
    Task LogAsync(
        string action,
        string entityType,
        Guid entityId,
        object? diff = null,
        CancellationToken cancellationToken = default);
}
