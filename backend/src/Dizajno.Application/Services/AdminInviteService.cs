using System.Security.Claims;
using Dizajno.Application.Interfaces;
using Dizajno.Application.Options;
using Dizajno.Data;
using Dizajno.Domain.Entities;
using Dizajno.Dto.Admin;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Dizajno.Application.Services;

public sealed class AdminInviteService : IAdminInviteService
{
    private readonly DizajnoDbContext _db;
    private readonly IAuditLogger _audit;
    private readonly InviteOptions _options;

    public AdminInviteService(DizajnoDbContext db, IAuditLogger audit, IOptions<InviteOptions> options)
    {
        _db = db;
        _audit = audit;
        _options = options.Value;
    }

    public async Task<ActionResult<IReadOnlyList<SupplierInviteDto>>> ListAsync(
        Guid? supplierId,
        bool includeRevoked,
        bool includeAccepted,
        CancellationToken cancellationToken)
    {
        var q = _db.SupplierInvites.AsNoTracking().AsQueryable();
        if (supplierId is { } s) q = q.Where(i => i.SupplierId == s);
        if (!includeRevoked) q = q.Where(i => i.RevokedAt == null);
        if (!includeAccepted) q = q.Where(i => i.AcceptedAt == null);
        var rows = await q
            .OrderByDescending(i => i.CreatedAt)
            .Select(i => new SupplierInviteDto(
                i.Id, i.SupplierId, i.InvitedEmail, i.Role, i.ExpiresAt,
                i.AcceptedAt, i.AcceptedByUserId, i.RevokedAt, i.CreatedAt,
                null, null))
            .ToListAsync(cancellationToken);
        return new OkObjectResult(rows);
    }

    public async Task<ActionResult<SupplierInviteDto>> CreateAsync(
        CreateSupplierInviteRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        var supplier = await _db.Suppliers.FirstOrDefaultAsync(s => s.Id == request.SupplierId, cancellationToken);
        if (supplier is null)
        {
            return new ObjectResult(new ProblemDetails { Detail = "Supplier not found.", Status = 400 }) { StatusCode = 400 };
        }

        var (raw, hash) = InviteTokenFactory.Generate();
        var actorId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        var lifetimeDays = Math.Clamp(request.ExpiresInDays ?? _options.DefaultLifetimeDays, 1, 90);

        var invite = new SupplierInvite
        {
            Id = Guid.NewGuid(),
            SupplierId = request.SupplierId,
            Role = request.Role,
            InvitedEmail = request.Email.Trim().ToLowerInvariant(),
            TokenHash = hash,
            ExpiresAt = DateTime.UtcNow.AddDays(lifetimeDays),
            CreatedByUserId = Guid.TryParse(actorId, out var parsed) ? parsed : Guid.Empty,
            CreatedAt = DateTime.UtcNow
        };
        _db.SupplierInvites.Add(invite);
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(
            "supplier_invite.create",
            nameof(SupplierInvite),
            invite.Id,
            new { invite.SupplierId, invite.InvitedEmail, invite.Role },
            cancellationToken);

        return new ObjectResult(new SupplierInviteDto(
            invite.Id, invite.SupplierId, invite.InvitedEmail, invite.Role, invite.ExpiresAt,
            invite.AcceptedAt, invite.AcceptedByUserId, invite.RevokedAt, invite.CreatedAt,
            Token: raw,
            AcceptUrl: BuildAcceptUrl(raw)))
        { StatusCode = 201 };
    }

    public async Task<ActionResult> RevokeAsync(Guid id, CancellationToken cancellationToken)
    {
        var invite = await _db.SupplierInvites.FirstOrDefaultAsync(i => i.Id == id, cancellationToken);
        if (invite is null) return new NotFoundResult();
        if (invite.RevokedAt is not null || invite.AcceptedAt is not null) return new NoContentResult();
        invite.RevokedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync("supplier_invite.revoke", nameof(SupplierInvite), id, diff: null, cancellationToken);
        return new NoContentResult();
    }

    private string BuildAcceptUrl(string rawToken) =>
        _options.AcceptUrlTemplate.Replace("{token}", rawToken);
}
