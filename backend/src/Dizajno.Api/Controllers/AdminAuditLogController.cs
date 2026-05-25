using Dizajno.Application.Interfaces;
using Dizajno.Dto.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Api.Controllers;

/// <summary>
/// Read-only audit-log search for the admin dashboard. Filters compose on
/// AND; results are page-sized to keep the dashboard snappy even after the
/// table grows to millions of rows. Page size is capped at 200.
/// </summary>
[ApiController]
[Route("api/admin/audit-log")]
[Authorize(Roles = "Admin")]
public sealed class AdminAuditLogController : ControllerBase
{
    private readonly IAdminAuditLogService _service;

    public AdminAuditLogController(IAdminAuditLogService service) => _service = service;

    [HttpGet]
    public Task<ActionResult<AuditLogPageDto>> Search(
        CancellationToken cancellationToken,
        [FromQuery] Guid? actorUserId = null,
        [FromQuery] string? action = null,
        [FromQuery] string? entityType = null,
        [FromQuery] Guid? entityId = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
        => _service.SearchAsync(actorUserId, action, entityType, entityId, from, to, page, pageSize, cancellationToken);
}
