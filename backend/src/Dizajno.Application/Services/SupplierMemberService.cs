using System.Security.Claims;
using Dizajno.Application.Interfaces;
using Dizajno.Data;
using Dizajno.Domain.Entities;
using Dizajno.Domain.Enums;
using Dizajno.Dto.Supplier;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dizajno.Application.Services;

public sealed class SupplierMemberService : ISupplierMemberService
{
    private readonly DizajnoDbContext _db;
    private readonly ISupplierMembershipResolver _memberships;
    private readonly IAuditLogger _audit;

    public SupplierMemberService(
        DizajnoDbContext db, ISupplierMembershipResolver memberships, IAuditLogger audit)
    {
        _db = db;
        _memberships = memberships;
        _audit = audit;
    }

    public async Task<ActionResult<IReadOnlyList<SupplierMemberSummaryDto>>> ListAsync(
        Guid supplierId,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);
        // Both Owner and Staff can see the roster; only Owners can mutate it.
        if (!memberships.IsActiveMemberOf(supplierId)) return new ForbidResult();

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
        return new OkObjectResult(dtos);
    }

    public async Task<ActionResult> ChangeRoleAsync(
        Guid id, ChangeMemberRoleRequest request, ClaimsPrincipal user, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var member = await _db.SupplierMembers.FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
        if (member is null) return new NotFoundResult();
        if (!memberships.IsActiveOwnerOf(member.SupplierId)) return new ForbidResult();
        if (member.Role == request.Role) return new NoContentResult();

        // Demoting the last Owner is forbidden.
        if (member.Role == SupplierMemberRole.Owner && request.Role == SupplierMemberRole.Staff)
        {
            var ownerCount = await _db.SupplierMembers
                .CountAsync(m => m.SupplierId == member.SupplierId && m.Role == SupplierMemberRole.Owner, cancellationToken);
            if (ownerCount <= 1)
                return new ObjectResult(new ProblemDetails
                {
                    Detail = "Cannot demote the last Owner. Promote another member to Owner first.",
                    Status = StatusCodes.Status409Conflict
                }) { StatusCode = StatusCodes.Status409Conflict };
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
        return new NoContentResult();
    }

    public async Task<ActionResult> RemoveAsync(Guid id, ClaimsPrincipal user, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var member = await _db.SupplierMembers.FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
        if (member is null) return new NotFoundResult();
        if (!memberships.IsActiveOwnerOf(member.SupplierId)) return new ForbidResult();

        // Same last-Owner safeguard as role change.
        if (member.Role == SupplierMemberRole.Owner)
        {
            var ownerCount = await _db.SupplierMembers
                .CountAsync(m => m.SupplierId == member.SupplierId && m.Role == SupplierMemberRole.Owner, cancellationToken);
            if (ownerCount <= 1)
                return new ObjectResult(new ProblemDetails
                {
                    Detail = "Cannot remove the last Owner. Promote another member to Owner first.",
                    Status = StatusCodes.Status409Conflict
                }) { StatusCode = StatusCodes.Status409Conflict };
        }

        _db.SupplierMembers.Remove(member);
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(
            "supplier_member.remove",
            nameof(SupplierMember),
            member.Id,
            new { member.SupplierId, member.UserId, member.Role },
            cancellationToken);
        return new NoContentResult();
    }

    private static bool TryGetUserId(ClaimsPrincipal user, out Guid userId)
    {
        var raw = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value;
        return Guid.TryParse(raw, out userId);
    }
}
