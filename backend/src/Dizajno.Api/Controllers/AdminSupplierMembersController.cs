using Dizajno.Api.Contracts;
using Dizajno.Domain.Entities;
using Dizajno.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dizajno.Api.Controllers;

/// <summary>
/// Phase-5 stopgap endpoint that lets admins bind users to suppliers. Real
/// member-management UI ships with the Phase 7 supplier portal; until then
/// this is how integration tests + Swagger smoke wire suppliers up.
/// </summary>
[ApiController]
[Route("api/admin/supplier-members")]
[Authorize(Roles = "Admin")]
public sealed class AdminSupplierMembersController : ControllerBase
{
    private readonly DizajnoDbContext _db;

    public AdminSupplierMembersController(DizajnoDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SupplierMemberDto>>> List(
        CancellationToken cancellationToken,
        [FromQuery] Guid? supplierId = null,
        [FromQuery] Guid? userId = null)
    {
        var query = _db.SupplierMembers
            .AsNoTracking()
            .AsQueryable();

        if (supplierId is { } s) query = query.Where(m => m.SupplierId == s);
        if (userId is { } u) query = query.Where(m => m.UserId == u);

        var rows = await query
            .OrderByDescending(m => m.CreatedAt)
            .Select(m => new
            {
                m.Id,
                m.SupplierId,
                SupplierSlug = m.Supplier.Slug,
                SupplierName = m.Supplier.Name,
                m.UserId,
                m.Role,
                m.CreatedAt
            })
            .ToListAsync(cancellationToken);

        // User email / display name aren't on the member row; join via Identity.
        var userIds = rows.Select(r => r.UserId).Distinct().ToList();
        var users = await _db.Users
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => new { u.Email, u.DisplayName }, cancellationToken);

        var dtos = rows.Select(r => new SupplierMemberDto(
            r.Id,
            r.SupplierId,
            r.SupplierSlug,
            r.SupplierName,
            r.UserId,
            users.TryGetValue(r.UserId, out var u) ? u.Email ?? string.Empty : string.Empty,
            users.TryGetValue(r.UserId, out var u2) ? u2.DisplayName : null,
            r.Role,
            r.CreatedAt)).ToList();

        return Ok(dtos);
    }

    [HttpPost]
    public async Task<ActionResult<SupplierMemberDto>> Create(
        CreateSupplierMemberRequest request,
        CancellationToken cancellationToken)
    {
        var supplier = await _db.Suppliers.FirstOrDefaultAsync(
            s => s.Id == request.SupplierId, cancellationToken);
        if (supplier is null)
        {
            return Problem("Supplier not found.", statusCode: StatusCodes.Status400BadRequest);
        }

        var user = await _db.Users.FirstOrDefaultAsync(
            u => u.Id == request.UserId, cancellationToken);
        if (user is null)
        {
            return Problem("User not found.", statusCode: StatusCodes.Status400BadRequest);
        }

        var existing = await _db.SupplierMembers.FirstOrDefaultAsync(
            m => m.SupplierId == request.SupplierId && m.UserId == request.UserId,
            cancellationToken);
        if (existing is not null)
        {
            // Idempotent: just update the role if it changed.
            if (existing.Role != request.Role)
            {
                existing.Role = request.Role;
                await _db.SaveChangesAsync(cancellationToken);
            }
            return Ok(new SupplierMemberDto(
                existing.Id, supplier.Id, supplier.Slug, supplier.Name,
                user.Id, user.Email ?? string.Empty, user.DisplayName,
                existing.Role, existing.CreatedAt));
        }

        var member = new SupplierMember
        {
            Id = Guid.NewGuid(),
            SupplierId = request.SupplierId,
            UserId = request.UserId,
            Role = request.Role,
            CreatedAt = DateTime.UtcNow
        };
        _db.SupplierMembers.Add(member);
        await _db.SaveChangesAsync(cancellationToken);

        return StatusCode(StatusCodes.Status201Created, new SupplierMemberDto(
            member.Id, supplier.Id, supplier.Slug, supplier.Name,
            user.Id, user.Email ?? string.Empty, user.DisplayName,
            member.Role, member.CreatedAt));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var member = await _db.SupplierMembers.FirstOrDefaultAsync(
            m => m.Id == id, cancellationToken);
        if (member is null)
        {
            return NotFound();
        }
        _db.SupplierMembers.Remove(member);
        await _db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
