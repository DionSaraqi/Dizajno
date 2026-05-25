using Dizajno.Dto.Admin;
using Dizajno.Dto.Asset;
using Dizajno.Dto.Auth;
using Dizajno.Dto.Catalog;
using Dizajno.Dto.Project;
using Dizajno.Dto.Quote;
using Dizajno.Dto.Share;
using Dizajno.Dto.Supplier;
using Dizajno.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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
    private const int MaxPageSize = 200;
    private readonly DizajnoDbContext _db;

    public AdminAuditLogController(DizajnoDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<AuditLogPageDto>> Search(
        CancellationToken cancellationToken,
        [FromQuery] Guid? actorUserId = null,
        [FromQuery] string? action = null,
        [FromQuery] string? entityType = null,
        [FromQuery] Guid? entityId = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        var q = _db.AuditLog.AsNoTracking().AsQueryable();
        if (actorUserId is { } a) q = q.Where(e => e.ActorUserId == a);
        if (!string.IsNullOrWhiteSpace(action)) q = q.Where(e => e.Action == action);
        if (!string.IsNullOrWhiteSpace(entityType)) q = q.Where(e => e.EntityType == entityType);
        if (entityId is { } id) q = q.Where(e => e.EntityId == id);
        if (from is { } f) q = q.Where(e => e.CreatedAt >= f);
        if (to is { } t) q = q.Where(e => e.CreatedAt <= t);

        var total = await q.CountAsync(cancellationToken);
        var rows = await q
            .OrderByDescending(e => e.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(e => new
            {
                e.Id, e.ActorUserId, e.Action, e.EntityType, e.EntityId,
                e.Diff, e.IpAddress, e.CreatedAt
            })
            .ToListAsync(cancellationToken);

        // Resolve actor emails in one trip to Identity. Null actors stay null.
        var actorIds = rows.Where(r => r.ActorUserId.HasValue)
            .Select(r => r.ActorUserId!.Value).Distinct().ToList();
        var emails = await _db.Users
            .AsNoTracking()
            .Where(u => actorIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Email, cancellationToken);

        var dtos = rows.Select(r => new AuditLogEntryDto(
            r.Id, r.ActorUserId,
            r.ActorUserId is { } aid && emails.TryGetValue(aid, out var em) ? em : null,
            r.Action, r.EntityType, r.EntityId, r.Diff, r.IpAddress, r.CreatedAt))
            .ToList();

        return Ok(new AuditLogPageDto(dtos, total, page, pageSize));
    }
}
