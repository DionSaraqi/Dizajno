using Dizajno.Dto.Admin;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Application.Interfaces;

public interface IAdminAuditLogService
{
    Task<ActionResult<AuditLogPageDto>> SearchAsync(
        Guid? actorUserId,
        string? action,
        string? entityType,
        Guid? entityId,
        DateTime? from,
        DateTime? to,
        int page,
        int pageSize,
        CancellationToken cancellationToken);
}
