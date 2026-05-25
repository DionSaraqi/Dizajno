using System.Security.Claims;
using Dizajno.Application.Interfaces;
using Dizajno.Application.Options;
using Dizajno.Data;
using Dizajno.Domain.Entities;
using Dizajno.Dto.Admin;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Dizajno.Application.Services;

public sealed class SupplierInviteService : ISupplierInviteService
{
    private readonly DizajnoDbContext _db;
    private readonly ISupplierMembershipResolver _memberships;
    private readonly IAuditLogger _audit;
    private readonly InviteOptions _options;

    public SupplierInviteService(
        DizajnoDbContext db,
        ISupplierMembershipResolver memberships,
        IAuditLogger audit,
        IOptions<InviteOptions> options)
    {
        _db = db;
        _memberships = memberships;
        _audit = audit;
        _options = options.Value;
    }

    public async Task<ActionResult<IReadOnlyList<SupplierInviteDto>>> ListAsync(
        Guid supplierId,
        bool includeRevoked,
        bool includeAccepted,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);
        // Read access: any active member can see the roster + invite list.
        if (!memberships.IsActiveMemberOf(supplierId)) return new ForbidResult();

        var q = _db.SupplierInvites
            .AsNoTracking()
            .Where(i => i.SupplierId == supplierId);
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
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);
        if (!memberships.IsActiveOwnerOf(request.SupplierId)) return new ForbidResult();

        var supplier = await _db.Suppliers.FirstOrDefaultAsync(s => s.Id == request.SupplierId, cancellationToken);
        if (supplier is null) return new ObjectResult(new ProblemDetails { Detail = "Supplier not found.", Status = StatusCodes.Status400BadRequest }) { StatusCode = StatusCodes.Status400BadRequest };

        var (raw, hash) = InviteTokenFactory.Generate();
        var lifetimeDays = Math.Clamp(request.ExpiresInDays ?? _options.DefaultLifetimeDays, 1, 90);

        var invite = new SupplierInvite
        {
            Id = Guid.NewGuid(),
            SupplierId = request.SupplierId,
            Role = request.Role,
            InvitedEmail = request.Email.Trim().ToLowerInvariant(),
            TokenHash = hash,
            ExpiresAt = DateTime.UtcNow.AddDays(lifetimeDays),
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };
        _db.SupplierInvites.Add(invite);
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(
            "supplier_invite.create_by_owner",
            nameof(SupplierInvite),
            invite.Id,
            new { invite.SupplierId, invite.InvitedEmail, invite.Role },
            cancellationToken);

        return new ObjectResult(new SupplierInviteDto(
            invite.Id, invite.SupplierId, invite.InvitedEmail, invite.Role, invite.ExpiresAt,
            invite.AcceptedAt, invite.AcceptedByUserId, invite.RevokedAt, invite.CreatedAt,
            Token: raw,
            AcceptUrl: _options.AcceptUrlTemplate.Replace("{token}", raw))) { StatusCode = StatusCodes.Status201Created };
    }

    public async Task<ActionResult> RevokeAsync(Guid id, ClaimsPrincipal user, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var invite = await _db.SupplierInvites.FirstOrDefaultAsync(i => i.Id == id, cancellationToken);
        if (invite is null) return new NotFoundResult();
        if (!memberships.IsActiveOwnerOf(invite.SupplierId)) return new ForbidResult();
        if (invite.RevokedAt is not null || invite.AcceptedAt is not null) return new NoContentResult();
        invite.RevokedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(
            "supplier_invite.revoke_by_owner",
            nameof(SupplierInvite),
            id,
            diff: null,
            cancellationToken);
        return new NoContentResult();
    }

    private static bool TryGetUserId(ClaimsPrincipal user, out Guid userId)
    {
        var raw = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value;
        return Guid.TryParse(raw, out userId);
    }
}
