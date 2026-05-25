using Dizajno.Application.Interfaces;
using Dizajno.Data;
using Dizajno.Dto.Admin;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dizajno.Application.Services;

public sealed class AdminAuditLogService : IAdminAuditLogService
{
    private const int MaxPageSize = 200;
    private readonly DizajnoDbContext _db;

    public AdminAuditLogService(DizajnoDbContext db) => _db = db;

    public async Task<ActionResult<AuditLogPageDto>> SearchAsync(
        Guid? actorUserId,
        string? action,
        string? entityType,
        Guid? entityId,
        DateTime? from,
        DateTime? to,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
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

        return new OkObjectResult(new AuditLogPageDto(dtos, total, page, pageSize));
    }
}
