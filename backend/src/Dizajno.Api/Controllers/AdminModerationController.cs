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
/// Admin moderation queues: pending products (every new product from an
/// untrusted supplier) + pending categories (supplier-suggested taxonomy
/// entries). Approve moves the row to the published/approved state; reject
/// hides the product or deletes the category outright.
/// </summary>
[ApiController]
[Route("api/admin/moderation")]
[Authorize(Roles = "Admin")]
public sealed class AdminModerationController : ControllerBase
{
    private readonly DizajnoDbContext _db;
    private readonly IAuditLogger _audit;

    public AdminModerationController(DizajnoDbContext db, IAuditLogger audit)
    {
        _db = db;
        _audit = audit;
    }

    [HttpGet("products")]
    public async Task<ActionResult<IReadOnlyList<PendingProductDto>>> ListPendingProducts(
        CancellationToken cancellationToken)
    {
        var rows = await _db.Products
            .AsNoTracking()
            .Where(p => p.Status == ProductStatus.Pending)
            .OrderBy(p => p.CreatedAt)
            .Select(p => new PendingProductDto(
                p.Id, p.Slug, p.Name, p.Family.ToString(),
                p.Category.Name, p.SupplierId, p.Supplier.Name, p.CreatedAt))
            .ToListAsync(cancellationToken);
        return Ok(rows);
    }

    [HttpPost("products/{id:guid}/approve")]
    public async Task<ActionResult> ApproveProduct(Guid id, CancellationToken cancellationToken)
    {
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (product is null) return NotFound();
        if (product.Status != ProductStatus.Pending)
            return Problem("Product is not in Pending state.", statusCode: StatusCodes.Status409Conflict);
        product.Status = ProductStatus.Published;
        product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(
            "product.approve",
            nameof(Product),
            product.Id,
            new { from = nameof(ProductStatus.Pending), to = nameof(ProductStatus.Published) },
            cancellationToken);
        return NoContent();
    }

    [HttpPost("products/{id:guid}/reject")]
    public async Task<ActionResult> RejectProduct(Guid id, CancellationToken cancellationToken)
    {
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (product is null) return NotFound();
        if (product.Status != ProductStatus.Pending)
            return Problem("Product is not in Pending state.", statusCode: StatusCodes.Status409Conflict);
        product.Status = ProductStatus.Hidden;
        product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(
            "product.reject",
            nameof(Product),
            product.Id,
            new { from = nameof(ProductStatus.Pending), to = nameof(ProductStatus.Hidden) },
            cancellationToken);
        return NoContent();
    }

    [HttpGet("categories")]
    public async Task<ActionResult<IReadOnlyList<PendingCategoryDto>>> ListPendingCategories(
        CancellationToken cancellationToken)
    {
        var rows = await _db.Categories
            .AsNoTracking()
            .Where(c => c.Status == CategoryStatus.Pending)
            .OrderBy(c => c.Family).ThenBy(c => c.Name)
            .Select(c => new
            {
                c.Id, c.Slug, c.Name, c.Family, c.Path, c.SuggestedBySupplierId
            })
            .ToListAsync(cancellationToken);

        var supplierIds = rows.Select(r => r.SuggestedBySupplierId)
            .Where(g => g.HasValue).Select(g => g!.Value).Distinct().ToList();
        var supplierNames = await _db.Suppliers
            .Where(s => supplierIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, s => s.Name, cancellationToken);

        var dtos = rows.Select(r => new PendingCategoryDto(
            r.Id, r.Slug, r.Name, r.Family.ToString(), r.Path,
            r.SuggestedBySupplierId,
            r.SuggestedBySupplierId is { } sid && supplierNames.TryGetValue(sid, out var name)
                ? name : null)).ToList();
        return Ok(dtos);
    }

    [HttpPost("categories/{id:guid}/approve")]
    public async Task<ActionResult> ApproveCategory(Guid id, CancellationToken cancellationToken)
    {
        var category = await _db.Categories.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
        if (category is null) return NotFound();
        if (category.Status != CategoryStatus.Pending)
            return Problem("Category is not in Pending state.", statusCode: StatusCodes.Status409Conflict);
        category.Status = CategoryStatus.Approved;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(
            "category.approve",
            nameof(Category),
            category.Id,
            new { category.Name, category.Family, category.SuggestedBySupplierId },
            cancellationToken);
        return NoContent();
    }

    [HttpPost("categories/{id:guid}/reject")]
    public async Task<ActionResult> RejectCategory(Guid id, CancellationToken cancellationToken)
    {
        var category = await _db.Categories.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
        if (category is null) return NotFound();
        if (category.Status != CategoryStatus.Pending)
            return Problem("Category is not in Pending state.", statusCode: StatusCodes.Status409Conflict);
        // Block reject if any product already hangs off this category — admin
        // should reassign first. Without this check we'd FK-restrict at save
        // time anyway, but the message is friendlier.
        var hasProducts = await _db.Products.AnyAsync(p => p.CategoryId == id, cancellationToken);
        if (hasProducts)
            return Problem("Category has products attached. Move them before rejecting.",
                statusCode: StatusCodes.Status409Conflict);
        _db.Categories.Remove(category);
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(
            "category.reject",
            nameof(Category),
            id,
            new { category.Name, category.Family, category.SuggestedBySupplierId },
            cancellationToken);
        return NoContent();
    }
}
