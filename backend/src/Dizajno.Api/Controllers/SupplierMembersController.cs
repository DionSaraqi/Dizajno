using System.Security.Claims;
using Dizajno.Api.Contracts;
using Dizajno.Application.Audit;
using Dizajno.Application.Suppliers;
using Dizajno.Domain.Entities;
using Dizajno.Domain.Enums;
using Dizajno.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dizajno.Api.Controllers;

/// <summary>
/// Phase 7b — Owner-only member management. Staff can do everything else in
/// the portal (catalog edits, quote responses) but cannot promote/demote/remove
/// other members or change the supplier profile.
///
/// Last-Owner protection: demoting the last Owner to Staff, or removing the
/// last Owner, fails with 409. The supplier must have at least one Owner at
/// all times. (An admin can still bind a new Owner via the Phase-5 stopgap
/// or issue a fresh invite if the team genuinely wants to roll over.)
/// </summary>
[ApiController]
[Route("api/supplier/members")]
[Authorize]
public sealed class SupplierMembersController : ControllerBase
{
    private readonly DizajnoDbContext _db;
    private readonly ISupplierMembershipResolver _memberships;
    private readonly IAuditLogger _audit;

    public SupplierMembersController(
        DizajnoDbContext db, ISupplierMembershipResolver memberships, IAuditLogger audit)
    {
        _db = db;
        _memberships = memberships;
        _audit = audit;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SupplierMemberSummaryDto>>> List(
        CancellationToken cancellationToken,
        [FromQuery] Guid supplierId)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);
        // Both Owner and Staff can see the roster; only Owners can mutate it.
        if (!memberships.IsActiveMemberOf(supplierId)) return Forbid();

        var rows = await _db.SupplierMembers
            .AsNoTracking()
            .Where(m => m.SupplierId == supplierId)
            .OrderBy(m => m.Role).ThenBy(m => m.CreatedAt)
            .Select(m => new
            {
                m.Id, m.SupplierId, m.UserId, m.Role, m.CreatedAt
            })
            .ToListAsync(cancellationToken);

        // Resolve emails / display names from Identity in one trip.
        var userIds = rows.Select(r => r.UserId).Distinct().ToList();
        var users = await _db.Users
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => new { u.Email, u.DisplayName }, cancellationToken);

        var dtos = rows.Select(r => new SupplierMemberSummaryDto(
            r.Id, r.SupplierId, r.UserId,
            users.TryGetValue(r.UserId, out var u) ? u.Email ?? string.Empty : string.Empty,
            users.TryGetValue(r.UserId, out var u2) ? u2.DisplayName : null,
            r.Role, r.CreatedAt)).ToList();
        return Ok(dtos);
    }

    [HttpPut("{id:guid}/role")]
    public async Task<ActionResult> ChangeRole(
        Guid id, ChangeMemberRoleRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var member = await _db.SupplierMembers.FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
        if (member is null) return NotFound();
        if (!memberships.IsActiveOwnerOf(member.SupplierId)) return Forbid();
        if (member.Role == request.Role) return NoContent();

        // Demoting the last Owner is forbidden.
        if (member.Role == SupplierMemberRole.Owner && request.Role == SupplierMemberRole.Staff)
        {
            var ownerCount = await _db.SupplierMembers
                .CountAsync(m => m.SupplierId == member.SupplierId && m.Role == SupplierMemberRole.Owner, cancellationToken);
            if (ownerCount <= 1)
                return Problem(
                    "Cannot demote the last Owner. Promote another member to Owner first.",
                    statusCode: StatusCodes.Status409Conflict);
        }

        var from = member.Role;
        member.Role = request.Role;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(
            "supplier_member.role_change",
            nameof(SupplierMember),
            member.Id,
            new { member.SupplierId, member.UserId, from = from.ToString(), to = request.Role.ToString() },
            cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Remove(Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var member = await _db.SupplierMembers.FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
        if (member is null) return NotFound();
        if (!memberships.IsActiveOwnerOf(member.SupplierId)) return Forbid();

        // Same last-Owner safeguard as role change.
        if (member.Role == SupplierMemberRole.Owner)
        {
            var ownerCount = await _db.SupplierMembers
                .CountAsync(m => m.SupplierId == member.SupplierId && m.Role == SupplierMemberRole.Owner, cancellationToken);
            if (ownerCount <= 1)
                return Problem(
                    "Cannot remove the last Owner. Promote another member to Owner first.",
                    statusCode: StatusCodes.Status409Conflict);
        }

        _db.SupplierMembers.Remove(member);
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(
            "supplier_member.remove",
            nameof(SupplierMember),
            member.Id,
            new { member.SupplierId, member.UserId, member.Role },
            cancellationToken);
        return NoContent();
    }

    private bool TryGetUserId(out Guid userId)
    {
        var raw = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(raw, out userId);
    }
}
