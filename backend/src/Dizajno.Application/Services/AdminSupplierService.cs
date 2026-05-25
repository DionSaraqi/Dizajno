using Dizajno.Application.Interfaces;
using Dizajno.Data;
using Dizajno.Domain.Entities;
using Dizajno.Domain.Enums;
using Dizajno.Dto.Admin;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dizajno.Application.Services;

public sealed class AdminSupplierService : IAdminSupplierService
{
    private readonly DizajnoDbContext _db;
    private readonly IAuditLogger _audit;

    public AdminSupplierService(DizajnoDbContext db, IAuditLogger audit)
    {
        _db = db;
        _audit = audit;
    }

    public async Task<ActionResult<IReadOnlyList<AdminSupplierDto>>> ListAsync(
        string? search,
        bool? suspended,
        bool? trusted,
        CancellationToken cancellationToken)
    {
        var q = _db.Suppliers.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var needle = $"%{search.Trim()}%";
            q = q.Where(s => EF.Functions.ILike(s.Name, needle) || EF.Functions.ILike(s.Slug, needle));
        }
        if (suspended is true) q = q.Where(s => s.SuspendedAt != null);
        else if (suspended is false) q = q.Where(s => s.SuspendedAt == null);
        if (trusted.HasValue) q = q.Where(s => s.IsTrusted == trusted.Value);

        var rows = await q
            .OrderBy(s => s.Name)
            .Select(s => new AdminSupplierDto(
                s.Id, s.Slug, s.Name, s.Description, s.WebsiteUrl,
                s.ContactEmail, s.ContactPhone, s.IsTrusted, s.SuspendedAt,
                s.Members.Count, s.Products.Count, s.CreatedAt))
            .ToListAsync(cancellationToken);
        return new OkObjectResult(rows);
    }

    public async Task<ActionResult<AdminSupplierDto>> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var row = await _db.Suppliers.AsNoTracking()
            .Where(s => s.Id == id)
            .Select(s => new AdminSupplierDto(
                s.Id, s.Slug, s.Name, s.Description, s.WebsiteUrl,
                s.ContactEmail, s.ContactPhone, s.IsTrusted, s.SuspendedAt,
                s.Members.Count, s.Products.Count, s.CreatedAt))
            .FirstOrDefaultAsync(cancellationToken);
        return row is null ? new NotFoundResult() : new OkObjectResult(row);
    }

    public async Task<ActionResult<AdminSupplierDto>> CreateAsync(
        CreateSupplierRequest request, CancellationToken cancellationToken)
    {
        var slug = request.Slug.Trim().ToLowerInvariant();
        if (await _db.Suppliers.AnyAsync(s => s.Slug == slug, cancellationToken))
        {
            return new ObjectResult(new ProblemDetails { Detail = "Slug already in use.", Status = StatusCodes.Status409Conflict }) { StatusCode = StatusCodes.Status409Conflict };
        }

        var supplier = new Supplier
        {
            Id = Guid.NewGuid(),
            Slug = slug,
            Name = request.Name.Trim(),
            Description = request.Description,
            WebsiteUrl = request.WebsiteUrl,
            ContactEmail = request.ContactEmail,
            ContactPhone = request.ContactPhone,
            IsTrusted = false,
            CreatedAt = DateTime.UtcNow
        };
        _db.Suppliers.Add(supplier);
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(
            "supplier.create",
            nameof(Supplier),
            supplier.Id,
            new { supplier.Slug, supplier.Name },
            cancellationToken);

        return new ObjectResult(new AdminSupplierDto(
            supplier.Id, supplier.Slug, supplier.Name, supplier.Description,
            supplier.WebsiteUrl, supplier.ContactEmail, supplier.ContactPhone,
            supplier.IsTrusted, supplier.SuspendedAt, 0, 0, supplier.CreatedAt))
        { StatusCode = StatusCodes.Status201Created };
    }

    public async Task<ActionResult<AdminSupplierDto>> UpdateAsync(
        Guid id, UpdateSupplierRequest request, CancellationToken cancellationToken)
    {
        var supplier = await _db.Suppliers.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (supplier is null) return new NotFoundResult();

        var before = new { supplier.Name, supplier.Description, supplier.WebsiteUrl, supplier.ContactEmail, supplier.ContactPhone };
        supplier.Name = request.Name.Trim();
        supplier.Description = request.Description;
        supplier.WebsiteUrl = request.WebsiteUrl;
        supplier.ContactEmail = request.ContactEmail;
        supplier.ContactPhone = request.ContactPhone;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(
            "supplier.update",
            nameof(Supplier),
            supplier.Id,
            new
            {
                before,
                after = new { supplier.Name, supplier.Description, supplier.WebsiteUrl, supplier.ContactEmail, supplier.ContactPhone }
            },
            cancellationToken);

        return new OkObjectResult(new AdminSupplierDto(
            supplier.Id, supplier.Slug, supplier.Name, supplier.Description,
            supplier.WebsiteUrl, supplier.ContactEmail, supplier.ContactPhone,
            supplier.IsTrusted, supplier.SuspendedAt,
            await _db.SupplierMembers.CountAsync(m => m.SupplierId == id, cancellationToken),
            await _db.Products.CountAsync(p => p.SupplierId == id, cancellationToken),
            supplier.CreatedAt));
    }

    public async Task<ActionResult> SuspendAsync(Guid id, CancellationToken cancellationToken)
    {
        var supplier = await _db.Suppliers.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (supplier is null) return new NotFoundResult();
        if (supplier.SuspendedAt is not null) return new NoContentResult(); // already suspended â†’ idempotent

        supplier.SuspendedAt = DateTime.UtcNow;

        // Auto-expire still-pending requests addressed to this supplier so
        // their requesters aren't left hanging. Cancellation reason flags
        // why so the UI can show "supplier_suspended" instead of generic Expired.
        var pendingRequests = await _db.QuoteRequests
            .Where(r => r.SupplierId == id && r.Status == QuoteRequestStatus.Pending)
            .ToListAsync(cancellationToken);
        foreach (var r in pendingRequests)
        {
            r.Status = QuoteRequestStatus.Expired;
            r.CancellationReason = "supplier_suspended";
        }
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(
            "supplier.suspend",
            nameof(Supplier),
            id,
            new { expiredRequestCount = pendingRequests.Count },
            cancellationToken);
        return new NoContentResult();
    }

    public async Task<ActionResult> RestoreAsync(Guid id, CancellationToken cancellationToken)
    {
        var supplier = await _db.Suppliers.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (supplier is null) return new NotFoundResult();
        if (supplier.SuspendedAt is null) return new NoContentResult();
        supplier.SuspendedAt = null;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync("supplier.restore", nameof(Supplier), id, diff: null, cancellationToken);
        return new NoContentResult();
    }

    public async Task<ActionResult> TrustAsync(Guid id, CancellationToken cancellationToken)
    {
        var supplier = await _db.Suppliers.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (supplier is null) return new NotFoundResult();
        if (supplier.IsTrusted) return new NoContentResult();
        supplier.IsTrusted = true;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync("supplier.trust", nameof(Supplier), id, diff: null, cancellationToken);
        return new NoContentResult();
    }

    public async Task<ActionResult> UntrustAsync(Guid id, CancellationToken cancellationToken)
    {
        var supplier = await _db.Suppliers.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (supplier is null) return new NotFoundResult();
        if (!supplier.IsTrusted) return new NoContentResult();
        supplier.IsTrusted = false;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync("supplier.untrust", nameof(Supplier), id, diff: null, cancellationToken);
        return new NoContentResult();
    }
}
