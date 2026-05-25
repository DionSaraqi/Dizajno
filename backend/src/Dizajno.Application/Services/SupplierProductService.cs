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

public sealed class SupplierProductService : ISupplierProductService
{
    private readonly DizajnoDbContext _db;
    private readonly ISupplierMembershipResolver _memberships;
    private readonly IAuditLogger _audit;

    public SupplierProductService(
        DizajnoDbContext db,
        ISupplierMembershipResolver memberships,
        IAuditLogger audit)
    {
        _db = db;
        _memberships = memberships;
        _audit = audit;
    }

    public async Task<ActionResult<IReadOnlyList<SupplierProductSummaryDto>>> ListAsync(
        ClaimsPrincipal user,
        Guid? supplierId,
        ProductStatus? status,
        string? search,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);
        var supplierIds = memberships.ActiveSupplierIds();
        if (supplierIds.Count == 0) return new ForbidResult();

        // Default: every product across every supplier the caller belongs to.
        // Specific supplierId narrows it; foreign ids 403 instead of returning empty.
        if (supplierId is { } targetId)
        {
            if (!supplierIds.Contains(targetId)) return new ForbidResult();
            supplierIds = new HashSet<Guid> { targetId };
        }

        var q = _db.Products
            .AsNoTracking()
            .Where(p => supplierIds.Contains(p.SupplierId))
            .Where(p => p.Status != ProductStatus.Removed);
        if (status is { } s) q = q.Where(p => p.Status == s);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var needle = $"%{search.Trim()}%";
            q = q.Where(p => EF.Functions.ILike(p.Name, needle) || EF.Functions.ILike(p.Slug, needle));
        }

        var rows = await q
            .OrderByDescending(p => p.UpdatedAt)
            .Select(p => new SupplierProductSummaryDto(
                p.Id, p.Slug, p.Name, p.Family.ToString(),
                p.CategoryId, p.Category.Name, p.Status,
                p.UnitOfSale.ToString(),
                p.Variants.OrderBy(v => v.SortOrder).Select(v => v.BasePrice).FirstOrDefault(),
                p.Variants.OrderBy(v => v.SortOrder).Select(v => v.Currency).FirstOrDefault() ?? "EUR",
                p.Variants.Count,
                p.CreatedAt, p.UpdatedAt))
            .ToListAsync(cancellationToken);
        return new OkObjectResult(rows);
    }

    public async Task<ActionResult<SupplierProductDetailDto>> GetAsync(
        Guid id,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var product = await _db.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.Variants.OrderBy(v => v.SortOrder))
                .ThenInclude(v => v.GlbAsset)
            .Include(p => p.Variants)
                .ThenInclude(v => v.SvgPreviewAsset)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (product is null) return new NotFoundResult();
        if (!memberships.IsActiveMemberOf(product.SupplierId)) return new ForbidResult();

        return new OkObjectResult(ToDetailDto(product));
    }

    public async Task<ActionResult<SupplierProductDetailDto>> CreateAsync(
        CreateProductRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);
        if (!memberships.IsActiveMemberOf(request.SupplierId)) return new ForbidResult();

        // Category must belong to the same family + be Approved (or supplier-suggested-pending that they own â€”
        // but suggested ones can't take products until approved, so just require Approved).
        var category = await _db.Categories.FirstOrDefaultAsync(c => c.Id == request.CategoryId, cancellationToken);
        if (category is null)
            return new ObjectResult(new ProblemDetails { Detail = "Category not found.", Status = StatusCodes.Status400BadRequest })
            { StatusCode = StatusCodes.Status400BadRequest };
        if (category.Family != request.Family)
            return new ObjectResult(new ProblemDetails
            {
                Detail = $"Category {category.Name} is in family {category.Family}, not {request.Family}.",
                Status = StatusCodes.Status400BadRequest
            })
            { StatusCode = StatusCodes.Status400BadRequest };
        if (category.Status != CategoryStatus.Approved)
            return new ObjectResult(new ProblemDetails
            {
                Detail = "Category is not yet approved â€” cannot attach products.",
                Status = StatusCodes.Status400BadRequest
            })
            { StatusCode = StatusCodes.Status400BadRequest };

        var slug = request.Slug.Trim().ToLowerInvariant();
        if (await _db.Products.AnyAsync(p => p.Slug == slug, cancellationToken))
            return new ObjectResult(new ProblemDetails { Detail = "Slug already in use.", Status = StatusCodes.Status409Conflict })
            { StatusCode = StatusCodes.Status409Conflict };

        var product = new Product
        {
            Id = Guid.NewGuid(),
            SupplierId = request.SupplierId,
            Family = request.Family,
            CategoryId = request.CategoryId,
            Slug = slug,
            Name = request.Name.Trim(),
            Description = request.Description,
            Status = ProductStatus.Draft,
            UnitOfSale = request.UnitOfSale,
            CoverageRate = request.CoverageRate,
            WasteFactor = request.WasteFactor,
            LeadTimeDays = request.LeadTimeDays,
            PreviewSvg = request.PreviewSvg,
            TextureUrl = request.TextureUrl,
            Attributes = string.IsNullOrWhiteSpace(request.Attributes) ? "{}" : request.Attributes,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.Products.Add(product);
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(
            "product.create",
            nameof(Product),
            product.Id,
            new { product.SupplierId, product.Slug, product.Name, product.Family, product.CategoryId },
            cancellationToken);

        // Re-read with eager loads for the response.
        product = await _db.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.Variants).ThenInclude(v => v.GlbAsset)
            .Include(p => p.Variants).ThenInclude(v => v.SvgPreviewAsset)
            .FirstAsync(p => p.Id == product.Id, cancellationToken);
        return new ObjectResult(ToDetailDto(product)) { StatusCode = StatusCodes.Status201Created };
    }

    public async Task<ActionResult<SupplierProductDetailDto>> UpdateAsync(
        Guid id,
        UpdateProductRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (product is null) return new NotFoundResult();
        if (!memberships.IsActiveMemberOf(product.SupplierId)) return new ForbidResult();
        if (product.Status == ProductStatus.Removed)
            return new ObjectResult(new ProblemDetails { Detail = "Removed products cannot be edited.", Status = StatusCodes.Status409Conflict })
            { StatusCode = StatusCodes.Status409Conflict };

        var category = await _db.Categories.FirstOrDefaultAsync(c => c.Id == request.CategoryId, cancellationToken);
        if (category is null)
            return new ObjectResult(new ProblemDetails { Detail = "Category not found.", Status = StatusCodes.Status400BadRequest })
            { StatusCode = StatusCodes.Status400BadRequest };
        if (category.Family != product.Family)
            return new ObjectResult(new ProblemDetails
            {
                Detail = $"Category {category.Name} is in family {category.Family}, not {product.Family}. " +
                    "Family is immutable; create a new product instead.",
                Status = StatusCodes.Status400BadRequest
            })
            { StatusCode = StatusCodes.Status400BadRequest };
        if (category.Status != CategoryStatus.Approved)
            return new ObjectResult(new ProblemDetails { Detail = "Category is not yet approved.", Status = StatusCodes.Status400BadRequest })
            { StatusCode = StatusCodes.Status400BadRequest };

        var before = new { product.Name, product.CategoryId, product.UnitOfSale, product.CoverageRate, product.WasteFactor };
        product.CategoryId = request.CategoryId;
        product.Name = request.Name.Trim();
        product.Description = request.Description;
        product.UnitOfSale = request.UnitOfSale;
        product.CoverageRate = request.CoverageRate;
        product.WasteFactor = request.WasteFactor;
        product.LeadTimeDays = request.LeadTimeDays;
        product.PreviewSvg = request.PreviewSvg;
        product.TextureUrl = request.TextureUrl;
        product.Attributes = string.IsNullOrWhiteSpace(request.Attributes) ? "{}" : request.Attributes;
        product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(
            "product.update",
            nameof(Product),
            product.Id,
            new { before, after = new { product.Name, product.CategoryId, product.UnitOfSale, product.CoverageRate, product.WasteFactor } },
            cancellationToken);

        var detail = await _db.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.Variants).ThenInclude(v => v.GlbAsset)
            .Include(p => p.Variants).ThenInclude(v => v.SvgPreviewAsset)
            .FirstAsync(p => p.Id == id, cancellationToken);
        return new OkObjectResult(ToDetailDto(detail));
    }

    public async Task<ActionResult> PublishAsync(
        Guid id,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var product = await _db.Products
            .Include(p => p.Supplier)
            .Include(p => p.Variants)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (product is null) return new NotFoundResult();
        if (!memberships.IsActiveMemberOf(product.SupplierId)) return new ForbidResult();
        if (product.Status == ProductStatus.Removed)
            return new ObjectResult(new ProblemDetails { Detail = "Removed products cannot be re-published.", Status = StatusCodes.Status409Conflict })
            { StatusCode = StatusCodes.Status409Conflict };
        if (product.Variants.Count == 0)
            return new ObjectResult(new ProblemDetails
            {
                Detail = "Product needs at least one variant before it can be published.",
                Status = StatusCodes.Status409Conflict
            })
            { StatusCode = StatusCodes.Status409Conflict };

        var from = product.Status;
        var trustedAutoPublish = product.Supplier.IsTrusted;
        // Already-Published products coming back via Hidden never re-enter Pending â€” already moderated once.
        var target = from switch
        {
            ProductStatus.Draft => trustedAutoPublish ? ProductStatus.Published : ProductStatus.Pending,
            ProductStatus.Hidden => ProductStatus.Published,
            ProductStatus.Pending => ProductStatus.Pending, // already pending, no-op
            ProductStatus.Published => ProductStatus.Published, // no-op
            _ => from
        };
        if (target == from) return new NoContentResult();

        product.Status = target;
        product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(
            target == ProductStatus.Pending ? "product.submit_for_review" : "product.publish",
            nameof(Product),
            product.Id,
            new { from = from.ToString(), to = target.ToString() },
            cancellationToken);
        return new NoContentResult();
    }

    public async Task<ActionResult> HideAsync(
        Guid id,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (product is null) return new NotFoundResult();
        if (!memberships.IsActiveMemberOf(product.SupplierId)) return new ForbidResult();
        if (product.Status == ProductStatus.Removed)
            return new ObjectResult(new ProblemDetails { Detail = "Removed products cannot be hidden.", Status = StatusCodes.Status409Conflict })
            { StatusCode = StatusCodes.Status409Conflict };
        if (product.Status == ProductStatus.Hidden) return new NoContentResult();

        var from = product.Status;
        product.Status = ProductStatus.Hidden;
        product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(
            "product.hide",
            nameof(Product),
            product.Id,
            new { from = from.ToString(), to = nameof(ProductStatus.Hidden) },
            cancellationToken);
        return new NoContentResult();
    }

    public async Task<ActionResult> RemoveAsync(
        Guid id,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (product is null) return new NotFoundResult();
        if (!memberships.IsActiveMemberOf(product.SupplierId)) return new ForbidResult();
        if (product.Status == ProductStatus.Removed) return new NoContentResult();

        var from = product.Status;
        product.Status = ProductStatus.Removed;
        product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(
            "product.remove",
            nameof(Product),
            product.Id,
            new { from = from.ToString(), to = nameof(ProductStatus.Removed) },
            cancellationToken);
        return new NoContentResult();
    }

    private static SupplierProductDetailDto ToDetailDto(Product p) => new(
        p.Id, p.SupplierId, p.Slug, p.Name, p.Family.ToString(),
        p.CategoryId, p.Category.Name, p.Status,
        p.UnitOfSale.ToString(), p.CoverageRate, p.WasteFactor, p.LeadTimeDays,
        p.Description, p.PreviewSvg, p.TextureUrl,
        p.Attributes,
        p.Variants
            .OrderBy(v => v.SortOrder)
            .Select(v => new SupplierVariantDto(
                v.Id, v.ProductId, v.Sku, v.Name, v.Width, v.Depth, v.Height,
                v.Color, v.BasePrice, v.Currency,
                v.GlbAssetId, v.GlbAsset?.Url,
                v.SvgPreviewAssetId, v.SvgPreviewAsset?.Url,
                v.CollisionBoxes, v.MaterialDefaults, v.Attributes,
                v.SortOrder, v.CreatedAt, v.UpdatedAt))
            .ToList(),
        p.CreatedAt, p.UpdatedAt);

    private static bool TryGetUserId(ClaimsPrincipal user, out Guid userId)
    {
        var raw = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value;
        return Guid.TryParse(raw, out userId);
    }
}
