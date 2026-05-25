using System.Security.Claims;
using Dizajno.Application.Interfaces;
using Dizajno.Data;
using Dizajno.Domain.Entities;
using Dizajno.Dto.Admin;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dizajno.Application.Services;

public sealed class InviteService : IInviteService
{
    private readonly DizajnoDbContext _db;
    private readonly IAuditLogger _audit;

    public InviteService(DizajnoDbContext db, IAuditLogger audit)
    {
        _db = db;
        _audit = audit;
    }

    public async Task<ActionResult<InvitePreviewDto>> PreviewAsync(string token, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token)) return new NotFoundResult();
        var hash = InviteTokenFactory.HashToken(token);
        var row = await _db.SupplierInvites
            .AsNoTracking()
            .Where(i => i.TokenHash == hash)
            .Select(i => new
            {
                i.Id,
                i.Role,
                i.InvitedEmail,
                i.ExpiresAt,
                i.AcceptedAt,
                i.RevokedAt,
                SupplierName = i.Supplier.Name,
                SupplierSlug = i.Supplier.Slug
            })
            .FirstOrDefaultAsync(cancellationToken);
        if (row is null) return new NotFoundResult();

        return new OkObjectResult(new InvitePreviewDto(
            row.SupplierName,
            row.SupplierSlug,
            row.Role,
            row.InvitedEmail,
            row.ExpiresAt,
            IsExpired: row.ExpiresAt <= DateTime.UtcNow,
            IsAccepted: row.AcceptedAt is not null,
            IsRevoked: row.RevokedAt is not null));
    }

    public async Task<ActionResult> AcceptAsync(string token, ClaimsPrincipal user, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token)) return new NotFoundResult();
        var hash = InviteTokenFactory.HashToken(token);
        var invite = await _db.SupplierInvites.FirstOrDefaultAsync(i => i.TokenHash == hash, cancellationToken);
        if (invite is null) return new NotFoundResult();
        if (invite.RevokedAt is not null)
            return new ObjectResult(new ProblemDetails { Detail = "Invite has been revoked.", Status = StatusCodes.Status410Gone }) { StatusCode = StatusCodes.Status410Gone };
        if (invite.ExpiresAt <= DateTime.UtcNow)
            return new ObjectResult(new ProblemDetails { Detail = "Invite has expired.", Status = StatusCodes.Status410Gone }) { StatusCode = StatusCodes.Status410Gone };

        var userIdClaim = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId)) return new UnauthorizedResult();

        if (invite.AcceptedAt is not null)
        {
            // Already accepted by somebody — make sure that somebody is the caller.
            if (invite.AcceptedByUserId != userId)
                return new ObjectResult(new ProblemDetails { Detail = "Invite has already been accepted by a different user.", Status = StatusCodes.Status409Conflict }) { StatusCode = StatusCodes.Status409Conflict };
            return new NoContentResult();
        }

        var existingMembership = await _db.SupplierMembers
            .FirstOrDefaultAsync(m => m.SupplierId == invite.SupplierId && m.UserId == userId, cancellationToken);
        if (existingMembership is null)
        {
            _db.SupplierMembers.Add(new SupplierMember
            {
                Id = Guid.NewGuid(),
                SupplierId = invite.SupplierId,
                UserId = userId,
                Role = invite.Role,
                CreatedAt = DateTime.UtcNow
            });
        }
        else if (existingMembership.Role != invite.Role)
        {
            // Promote / demote to the invite's role so accepting a fresh
            // Owner invite for an already-Staff member actually upgrades them.
            existingMembership.Role = invite.Role;
        }

        invite.AcceptedAt = DateTime.UtcNow;
        invite.AcceptedByUserId = userId;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(
            "supplier_invite.accept",
            nameof(SupplierInvite),
            invite.Id,
            new { invite.SupplierId, userId, invite.Role },
            cancellationToken);
        return new NoContentResult();
    }
}
