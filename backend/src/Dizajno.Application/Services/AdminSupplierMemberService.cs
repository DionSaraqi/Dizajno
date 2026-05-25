using Dizajno.Application.Interfaces;
using Dizajno.Data;
using Dizajno.Domain.Entities;
using Dizajno.Dto.Admin;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dizajno.Application.Services;

public sealed class AdminSupplierMemberService : IAdminSupplierMemberService
{
    private readonly DizajnoDbContext _db;

    public AdminSupplierMemberService(DizajnoDbContext db) => _db = db;

    public async Task<ActionResult<IReadOnlyList<SupplierMemberDto>>> ListAsync(
        Guid? supplierId,
        Guid? userId,
        CancellationToken cancellationToken)
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

        return new OkObjectResult(dtos);
    }

    public async Task<ActionResult<SupplierMemberDto>> CreateAsync(
        CreateSupplierMemberRequest request,
        CancellationToken cancellationToken)
    {
        var supplier = await _db.Suppliers.FirstOrDefaultAsync(
            s => s.Id == request.SupplierId, cancellationToken);
        if (supplier is null)
        {
            return new ObjectResult(new ProblemDetails { Detail = "Supplier not found.", Status = StatusCodes.Status400BadRequest }) { StatusCode = StatusCodes.Status400BadRequest };
        }

        var user = await _db.Users.FirstOrDefaultAsync(
            u => u.Id == request.UserId, cancellationToken);
        if (user is null)
        {
            return new ObjectResult(new ProblemDetails { Detail = "User not found.", Status = StatusCodes.Status400BadRequest }) { StatusCode = StatusCodes.Status400BadRequest };
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
            return new OkObjectResult(new SupplierMemberDto(
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

        return new ObjectResult(new SupplierMemberDto(
            member.Id, supplier.Id, supplier.Slug, supplier.Name,
            user.Id, user.Email ?? string.Empty, user.DisplayName,
            member.Role, member.CreatedAt)) { StatusCode = StatusCodes.Status201Created };
    }

    public async Task<ActionResult> DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var member = await _db.SupplierMembers.FirstOrDefaultAsync(
            m => m.Id == id, cancellationToken);
        if (member is null)
        {
            return new NotFoundResult();
        }
        _db.SupplierMembers.Remove(member);
        await _db.SaveChangesAsync(cancellationToken);
        return new NoContentResult();
    }
}
