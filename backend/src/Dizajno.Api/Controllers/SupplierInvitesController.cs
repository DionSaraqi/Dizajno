using System.Security.Claims;
using Dizajno.Api.Contracts;
using Dizajno.Application.Audit;
using Dizajno.Application.Suppliers;
using Dizajno.Domain.Entities;
using Dizajno.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Dizajno.Api.Controllers;

/// <summary>
/// Phase 7c — Owner-side invite issuance. Mirrors <see cref="AdminInvitesController"/>
/// but gated by <see cref="SupplierMembershipExtensions.IsActiveOwnerOf"/> instead
/// of the Admin role, so Owners can grow their team without admin involvement.
///
/// Token persistence, hashing, AcceptUrl construction, and the public accept
/// flow at <c>/api/invites/{token}/accept</c> are all reused from Phase 7a —
/// the only difference is who can mint the link.
/// </summary>
[ApiController]
[Route("api/supplier/invites")]
[Authorize]
public sealed class SupplierInvitesController : ControllerBase
{
    private readonly DizajnoDbContext _db;
    private readonly ISupplierMembershipResolver _memberships;
    private readonly IAuditLogger _audit;
    private readonly InviteOptions _options;

    public SupplierInvitesController(
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

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SupplierInviteDto>>> List(
        CancellationToken cancellationToken,
        [FromQuery] Guid supplierId,
        [FromQuery] bool includeRevoked = false,
        [FromQuery] bool includeAccepted = true)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);
        // Read access: any active member can see the roster + invite list.
        if (!memberships.IsActiveMemberOf(supplierId)) return Forbid();

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
        return Ok(rows);
    }

    [HttpPost]
    public async Task<ActionResult<SupplierInviteDto>> Create(
        CreateSupplierInviteRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);
        if (!memberships.IsActiveOwnerOf(request.SupplierId)) return Forbid();

        var supplier = await _db.Suppliers.FirstOrDefaultAsync(s => s.Id == request.SupplierId, cancellationToken);
        if (supplier is null) return Problem("Supplier not found.", statusCode: StatusCodes.Status400BadRequest);

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

        return StatusCode(StatusCodes.Status201Created, new SupplierInviteDto(
            invite.Id, invite.SupplierId, invite.InvitedEmail, invite.Role, invite.ExpiresAt,
            invite.AcceptedAt, invite.AcceptedByUserId, invite.RevokedAt, invite.CreatedAt,
            Token: raw,
            AcceptUrl: _options.AcceptUrlTemplate.Replace("{token}", raw)));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Revoke(Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var invite = await _db.SupplierInvites.FirstOrDefaultAsync(i => i.Id == id, cancellationToken);
        if (invite is null) return NotFound();
        if (!memberships.IsActiveOwnerOf(invite.SupplierId)) return Forbid();
        if (invite.RevokedAt is not null || invite.AcceptedAt is not null) return NoContent();
        invite.RevokedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(
            "supplier_invite.revoke_by_owner",
            nameof(SupplierInvite),
            id,
            diff: null,
            cancellationToken);
        return NoContent();
    }

    private bool TryGetUserId(out Guid userId)
    {
        var raw = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(raw, out userId);
    }
}
