using System.Security.Claims;
using System.Security.Cryptography;
using Dizajno.Api.Contracts;
using Dizajno.Application.Audit;
using Dizajno.Domain.Entities;
using Dizajno.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Dizajno.Api.Controllers;

/// <summary>
/// Admin endpoints for issuing supplier invites. The raw token returned on
/// create is the only chance to capture it — the DB stores a SHA-256 hash and
/// the response also includes a ready-made <c>AcceptUrl</c> built from
/// <see cref="InviteOptions.AcceptUrlTemplate"/> so the admin can copy/paste
/// straight into Slack/email/etc.
/// </summary>
[ApiController]
[Route("api/admin/invites")]
[Authorize(Roles = "Admin")]
public sealed class AdminInvitesController : ControllerBase
{
    private readonly DizajnoDbContext _db;
    private readonly IAuditLogger _audit;
    private readonly InviteOptions _options;

    public AdminInvitesController(DizajnoDbContext db, IAuditLogger audit, IOptions<InviteOptions> options)
    {
        _db = db;
        _audit = audit;
        _options = options.Value;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SupplierInviteDto>>> List(
        CancellationToken cancellationToken,
        [FromQuery] Guid? supplierId = null,
        [FromQuery] bool includeRevoked = false,
        [FromQuery] bool includeAccepted = true)
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
        return Ok(rows);
    }

    [HttpPost]
    public async Task<ActionResult<SupplierInviteDto>> Create(
        CreateSupplierInviteRequest request, CancellationToken cancellationToken)
    {
        var supplier = await _db.Suppliers.FirstOrDefaultAsync(s => s.Id == request.SupplierId, cancellationToken);
        if (supplier is null) return Problem("Supplier not found.", statusCode: StatusCodes.Status400BadRequest);

        var (raw, hash) = InviteTokenFactory.Generate();
        var actorId = User.FindFirstValue(ClaimTypes.NameIdentifier);
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

        return StatusCode(StatusCodes.Status201Created, new SupplierInviteDto(
            invite.Id, invite.SupplierId, invite.InvitedEmail, invite.Role, invite.ExpiresAt,
            invite.AcceptedAt, invite.AcceptedByUserId, invite.RevokedAt, invite.CreatedAt,
            Token: raw,
            AcceptUrl: BuildAcceptUrl(raw)));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Revoke(Guid id, CancellationToken cancellationToken)
    {
        var invite = await _db.SupplierInvites.FirstOrDefaultAsync(i => i.Id == id, cancellationToken);
        if (invite is null) return NotFound();
        if (invite.RevokedAt is not null || invite.AcceptedAt is not null) return NoContent();
        invite.RevokedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync("supplier_invite.revoke", nameof(SupplierInvite), id, diff: null, cancellationToken);
        return NoContent();
    }

    private string BuildAcceptUrl(string rawToken) =>
        _options.AcceptUrlTemplate.Replace("{token}", rawToken);
}

/// <summary>Configuration for invite URLs and default lifetimes. Bound from <c>Invites</c> in appsettings.</summary>
public sealed class InviteOptions
{
    /// <summary>URL template containing the literal <c>{token}</c> placeholder; defaults to the frontend dev port.</summary>
    public string AcceptUrlTemplate { get; set; } = "http://localhost:3000/invite/{token}";
    public int DefaultLifetimeDays { get; set; } = 14;
}

internal static class InviteTokenFactory
{
    public static (string RawToken, string Hash) Generate()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        var raw = Convert.ToBase64String(bytes)
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');
        return (raw, HashToken(raw));
    }

    public static string HashToken(string rawToken)
    {
        var hash = SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(rawToken));
        return Convert.ToBase64String(hash);
    }
}
