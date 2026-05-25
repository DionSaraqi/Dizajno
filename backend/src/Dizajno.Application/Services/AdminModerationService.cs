using Dizajno.Application.Interfaces;
using Dizajno.Data;
using Dizajno.Domain.Entities;
using Dizajno.Domain.Enums;
using Dizajno.Dto.Admin;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dizajno.Application.Services;

public sealed class AdminModerationService : IAdminModerationService
{
    private readonly DizajnoDbContext _db;
    private readonly IAuditLogger _audit;

    public AdminModerationService(DizajnoDbContext db, IAuditLogger audit)
    {
        _db = db;
        _audit = audit;
    }

    public async Task<ActionResult<IReadOnlyList<PendingProductDto>>> ListPendingProductsAsync(
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
        return new OkObjectResult(rows);
    }

    public async Task<ActionResult> ApproveProductAsync(Guid id, CancellationToken cancellationToken)
    {
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (product is null) return new NotFoundResult();
        if (product.Status != ProductStatus.Pending)
            return new ObjectResult(new ProblemDetails { Detail = "Product is not in Pending state.", Status = StatusCodes.Status409Conflict }) { StatusCode = StatusCodes.Status409Conflict };
        product.Status = ProductStatus.Published;
        product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(
            "product.approve",
            nameof(Product),
            product.Id,
            new { from = nameof(ProductStatus.Pending), to = nameof(ProductStatus.Published) },
            cancellationToken);
        return new NoContentResult();
    }

    public async Task<ActionResult> RejectProductAsync(Guid id, CancellationToken cancellationToken)
    {
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (product is null) return new NotFoundResult();
        if (product.Status != ProductStatus.Pending)
            return new ObjectResult(new ProblemDetails { Detail = "Product is not in Pending state.", Status = StatusCodes.Status409Conflict }) { StatusCode = StatusCodes.Status409Conflict };
        product.Status = ProductStatus.Hidden;
        product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(
            "product.reject",
            nameof(Product),
            product.Id,
            new { from = nameof(ProductStatus.Pending), to = nameof(ProductStatus.Hidden) },
            cancellationToken);
        return new NoContentResult();
    }

    public async Task<ActionResult<IReadOnlyList<PendingCategoryDto>>> ListPendingCategoriesAsync(
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
        return new OkObjectResult(dtos);
    }

    public async Task<ActionResult> ApproveCategoryAsync(Guid id, CancellationToken cancellationToken)
    {
        var category = await _db.Categories.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
        if (category is null) return new NotFoundResult();
        if (category.Status != CategoryStatus.Pending)
            return new ObjectResult(new ProblemDetails { Detail = "Category is not in Pending state.", Status = StatusCodes.Status409Conflict }) { StatusCode = StatusCodes.Status409Conflict };
        category.Status = CategoryStatus.Approved;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(
            "category.approve",
            nameof(Category),
            category.Id,
            new { category.Name, category.Family, category.SuggestedBySupplierId },
            cancellationToken);
        return new NoContentResult();
    }

    public async Task<ActionResult> RejectCategoryAsync(Guid id, CancellationToken cancellationToken)
    {
        var category = await _db.Categories.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
        if (category is null) return new NotFoundResult();
        if (category.Status != CategoryStatus.Pending)
            return new ObjectResult(new ProblemDetails { Detail = "Category is not in Pending state.", Status = StatusCodes.Status409Conflict }) { StatusCode = StatusCodes.Status409Conflict };
        // Block reject if any product already hangs off this category â€” admin
        // should reassign first. Without this check we'd FK-restrict at save
        // time anyway, but the message is friendlier.
        var hasProducts = await _db.Products.AnyAsync(p => p.CategoryId == id, cancellationToken);
        if (hasProducts)
            return new ObjectResult(new ProblemDetails { Detail = "Category has products attached. Move them before rejecting.", Status = StatusCodes.Status409Conflict }) { StatusCode = StatusCodes.Status409Conflict };
        _db.Categories.Remove(category);
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(
            "category.reject",
            nameof(Category),
            id,
            new { category.Name, category.Family, category.SuggestedBySupplierId },
            cancellationToken);
        return new NoContentResult();
    }
}
