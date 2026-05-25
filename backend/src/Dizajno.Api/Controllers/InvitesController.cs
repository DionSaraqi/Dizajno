using System.Security.Claims;
using Dizajno.Dto.Admin;
using Dizajno.Dto.Asset;
using Dizajno.Dto.Auth;
using Dizajno.Dto.Catalog;
using Dizajno.Dto.Project;
using Dizajno.Dto.Quote;
using Dizajno.Dto.Share;
using Dizajno.Dto.Supplier;
using Dizajno.Application.Audit;
using Dizajno.Domain.Entities;
using Dizajno.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dizajno.Api.Controllers;

/// <summary>
/// Public-side invite handling. Preview is anonymous (so the invite-accept
/// page can render the supplier name + role before forcing login); accept
/// requires a signed-in user and binds them as a <see cref="SupplierMember"/>.
/// Existing memberships are honoured idempotently â€” re-accepting an already
/// accepted invite is a no-op.
/// </summary>
[ApiController]
[Route("api/invites")]
public sealed class InvitesController : ControllerBase
{
    private readonly DizajnoDbContext _db;
    private readonly IAuditLogger _audit;

    public InvitesController(DizajnoDbContext db, IAuditLogger audit)
    {
        _db = db;
        _audit = audit;
    }

    [HttpGet("{token}")]
    [AllowAnonymous]
    public async Task<ActionResult<InvitePreviewDto>> Preview(string token, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token)) return NotFound();
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
        if (row is null) return NotFound();

        return Ok(new InvitePreviewDto(
            row.SupplierName,
            row.SupplierSlug,
            row.Role,
            row.InvitedEmail,
            row.ExpiresAt,
            IsExpired: row.ExpiresAt <= DateTime.UtcNow,
            IsAccepted: row.AcceptedAt is not null,
            IsRevoked: row.RevokedAt is not null));
    }

    [HttpPost("{token}/accept")]
    [Authorize]
    public async Task<ActionResult> Accept(string token, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token)) return NotFound();
        var hash = InviteTokenFactory.HashToken(token);
        var invite = await _db.SupplierInvites.FirstOrDefaultAsync(i => i.TokenHash == hash, cancellationToken);
        if (invite is null) return NotFound();
        if (invite.RevokedAt is not null)
            return Problem("Invite has been revoked.", statusCode: StatusCodes.Status410Gone);
        if (invite.ExpiresAt <= DateTime.UtcNow)
            return Problem("Invite has expired.", statusCode: StatusCodes.Status410Gone);

        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId)) return Unauthorized();

        if (invite.AcceptedAt is not null)
        {
            // Already accepted by somebody â€” make sure that somebody is the caller.
            if (invite.AcceptedByUserId != userId)
                return Problem("Invite has already been accepted by a different user.",
                    statusCode: StatusCodes.Status409Conflict);
            return NoContent();
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
        return NoContent();
    }
}
