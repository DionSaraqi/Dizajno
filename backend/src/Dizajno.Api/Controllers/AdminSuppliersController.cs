using Dizajno.Api.Contracts;
using Dizajno.Application.Audit;
using Dizajno.Domain.Entities;
using Dizajno.Domain.Enums;
using Dizajno.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dizajno.Api.Controllers;

/// <summary>
/// Phase 7a admin endpoints for the supplier directory. Lets admins create
/// suppliers, edit their public profile, and flip the two operational toggles
/// (<see cref="Supplier.IsTrusted"/> and <see cref="Supplier.SuspendedAt"/>).
/// Suspending a supplier also auto-expires every still-Pending QuoteRequest
/// they have outstanding so requesters don't sit waiting on a dead supplier.
/// </summary>
[ApiController]
[Route("api/admin/suppliers")]
[Authorize(Roles = "Admin")]
public sealed class AdminSuppliersController : ControllerBase
{
    private readonly DizajnoDbContext _db;
    private readonly IAuditLogger _audit;

    public AdminSuppliersController(DizajnoDbContext db, IAuditLogger audit)
    {
        _db = db;
        _audit = audit;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AdminSupplierDto>>> List(
        CancellationToken cancellationToken,
        [FromQuery] string? search = null,
        [FromQuery] bool? suspended = null,
        [FromQuery] bool? trusted = null)
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
        return Ok(rows);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AdminSupplierDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var row = await _db.Suppliers.AsNoTracking()
            .Where(s => s.Id == id)
            .Select(s => new AdminSupplierDto(
                s.Id, s.Slug, s.Name, s.Description, s.WebsiteUrl,
                s.ContactEmail, s.ContactPhone, s.IsTrusted, s.SuspendedAt,
                s.Members.Count, s.Products.Count, s.CreatedAt))
            .FirstOrDefaultAsync(cancellationToken);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost]
    public async Task<ActionResult<AdminSupplierDto>> Create(
        CreateSupplierRequest request, CancellationToken cancellationToken)
    {
        var slug = request.Slug.Trim().ToLowerInvariant();
        if (await _db.Suppliers.AnyAsync(s => s.Slug == slug, cancellationToken))
        {
            return Problem("Slug already in use.", statusCode: StatusCodes.Status409Conflict);
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

        return StatusCode(StatusCodes.Status201Created, new AdminSupplierDto(
            supplier.Id, supplier.Slug, supplier.Name, supplier.Description,
            supplier.WebsiteUrl, supplier.ContactEmail, supplier.ContactPhone,
            supplier.IsTrusted, supplier.SuspendedAt, 0, 0, supplier.CreatedAt));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<AdminSupplierDto>> Update(
        Guid id, UpdateSupplierRequest request, CancellationToken cancellationToken)
    {
        var supplier = await _db.Suppliers.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (supplier is null) return NotFound();

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

        return Ok(new AdminSupplierDto(
            supplier.Id, supplier.Slug, supplier.Name, supplier.Description,
            supplier.WebsiteUrl, supplier.ContactEmail, supplier.ContactPhone,
            supplier.IsTrusted, supplier.SuspendedAt,
            await _db.SupplierMembers.CountAsync(m => m.SupplierId == id, cancellationToken),
            await _db.Products.CountAsync(p => p.SupplierId == id, cancellationToken),
            supplier.CreatedAt));
    }

    [HttpPost("{id:guid}/suspend")]
    public async Task<ActionResult> Suspend(Guid id, CancellationToken cancellationToken)
    {
        var supplier = await _db.Suppliers.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (supplier is null) return NotFound();
        if (supplier.SuspendedAt is not null) return NoContent(); // already suspended → idempotent

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
        return NoContent();
    }

    [HttpPost("{id:guid}/restore")]
    public async Task<ActionResult> Restore(Guid id, CancellationToken cancellationToken)
    {
        var supplier = await _db.Suppliers.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (supplier is null) return NotFound();
        if (supplier.SuspendedAt is null) return NoContent();
        supplier.SuspendedAt = null;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync("supplier.restore", nameof(Supplier), id, diff: null, cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:guid}/trust")]
    public async Task<ActionResult> Trust(Guid id, CancellationToken cancellationToken)
    {
        var supplier = await _db.Suppliers.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (supplier is null) return NotFound();
        if (supplier.IsTrusted) return NoContent();
        supplier.IsTrusted = true;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync("supplier.trust", nameof(Supplier), id, diff: null, cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:guid}/untrust")]
    public async Task<ActionResult> Untrust(Guid id, CancellationToken cancellationToken)
    {
        var supplier = await _db.Suppliers.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (supplier is null) return NotFound();
        if (!supplier.IsTrusted) return NoContent();
        supplier.IsTrusted = false;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync("supplier.untrust", nameof(Supplier), id, diff: null, cancellationToken);
        return NoContent();
    }
}
