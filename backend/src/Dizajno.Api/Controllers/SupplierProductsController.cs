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
using Dizajno.Application.Suppliers;
using Dizajno.Domain.Entities;
using Dizajno.Domain.Enums;
using Dizajno.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dizajno.Api.Controllers;

/// <summary>
/// Phase 7b â€” supplier-facing product CRUD + status transitions.
///
/// Lifecycle the supplier controls:
/// <list type="bullet">
///   <item><c>Draft</c> â† create. Hidden from public catalog; freely editable.</item>
///   <item><c>Draft â†’ Pending</c> via <c>POST /{id}/publish</c> for untrusted suppliers; admin moderation queue picks it up.</item>
///   <item><c>Draft â†’ Published</c> via the same endpoint for trusted suppliers (<see cref="Supplier.IsTrusted"/>).</item>
///   <item><c>Published â†’ Hidden</c> via <c>POST /{id}/hide</c>. Supplier-initiated unpublish.</item>
///   <item><c>Hidden â†’ Published</c> via <c>POST /{id}/publish</c>. Never re-triggers Pending â€” already moderated once.</item>
///   <item><c>* â†’ Removed</c> via <c>POST /{id}/remove</c>. Historical <c>QuoteLine.variant_snapshot</c> still protects past quotes.</item>
/// </list>
///
/// Editing a Published product (name/description/etc.) does <em>not</em> re-trigger Pending â€” by design, decided in Phase 7
/// planning. Future moderation needs (e.g. flagging post-publish edits) would slot in via a separate audit-driven workflow.
/// </summary>
[ApiController]
[Route("api/supplier/products")]
[Authorize]
public sealed class SupplierProductsController : ControllerBase
{
    private readonly DizajnoDbContext _db;
    private readonly ISupplierMembershipResolver _memberships;
    private readonly IAuditLogger _audit;

    public SupplierProductsController(
        DizajnoDbContext db,
        ISupplierMembershipResolver memberships,
        IAuditLogger audit)
    {
        _db = db;
        _memberships = memberships;
        _audit = audit;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SupplierProductSummaryDto>>> List(
        CancellationToken cancellationToken,
        [FromQuery] Guid? supplierId = null,
        [FromQuery] ProductStatus? status = null,
        [FromQuery] string? search = null)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);
        var supplierIds = memberships.ActiveSupplierIds();
        if (supplierIds.Count == 0) return Forbid();

        // Default: every product across every supplier the caller belongs to.
        // Specific supplierId narrows it; foreign ids 403 instead of returning empty.
        if (supplierId is { } targetId)
        {
            if (!supplierIds.Contains(targetId)) return Forbid();
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
        return Ok(rows);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<SupplierProductDetailDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var product = await _db.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.Variants.OrderBy(v => v.SortOrder))
                .ThenInclude(v => v.GlbAsset)
            .Include(p => p.Variants)
                .ThenInclude(v => v.SvgPreviewAsset)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (product is null) return NotFound();
        if (!memberships.IsActiveMemberOf(product.SupplierId)) return Forbid();

        return Ok(ToDetailDto(product));
    }

    [HttpPost]
    public async Task<ActionResult<SupplierProductDetailDto>> Create(
        CreateProductRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);
        if (!memberships.IsActiveMemberOf(request.SupplierId)) return Forbid();

        // Category must belong to the same family + be Approved (or supplier-suggested-pending that they own â€”
        // but suggested ones can't take products until approved, so just require Approved).
        var category = await _db.Categories.FirstOrDefaultAsync(c => c.Id == request.CategoryId, cancellationToken);
        if (category is null) return Problem("Category not found.", statusCode: StatusCodes.Status400BadRequest);
        if (category.Family != request.Family)
            return Problem($"Category {category.Name} is in family {category.Family}, not {request.Family}.",
                statusCode: StatusCodes.Status400BadRequest);
        if (category.Status != CategoryStatus.Approved)
            return Problem("Category is not yet approved â€” cannot attach products.",
                statusCode: StatusCodes.Status400BadRequest);

        var slug = request.Slug.Trim().ToLowerInvariant();
        if (await _db.Products.AnyAsync(p => p.Slug == slug, cancellationToken))
            return Problem("Slug already in use.", statusCode: StatusCodes.Status409Conflict);

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
        return StatusCode(StatusCodes.Status201Created, ToDetailDto(product));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<SupplierProductDetailDto>> Update(
        Guid id, UpdateProductRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (product is null) return NotFound();
        if (!memberships.IsActiveMemberOf(product.SupplierId)) return Forbid();
        if (product.Status == ProductStatus.Removed)
            return Problem("Removed products cannot be edited.", statusCode: StatusCodes.Status409Conflict);

        var category = await _db.Categories.FirstOrDefaultAsync(c => c.Id == request.CategoryId, cancellationToken);
        if (category is null) return Problem("Category not found.", statusCode: StatusCodes.Status400BadRequest);
        if (category.Family != product.Family)
            return Problem($"Category {category.Name} is in family {category.Family}, not {product.Family}. " +
                "Family is immutable; create a new product instead.",
                statusCode: StatusCodes.Status400BadRequest);
        if (category.Status != CategoryStatus.Approved)
            return Problem("Category is not yet approved.", statusCode: StatusCodes.Status400BadRequest);

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
        return Ok(ToDetailDto(detail));
    }

    [HttpPost("{id:guid}/publish")]
    public async Task<ActionResult> Publish(Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var product = await _db.Products
            .Include(p => p.Supplier)
            .Include(p => p.Variants)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (product is null) return NotFound();
        if (!memberships.IsActiveMemberOf(product.SupplierId)) return Forbid();
        if (product.Status == ProductStatus.Removed)
            return Problem("Removed products cannot be re-published.", statusCode: StatusCodes.Status409Conflict);
        if (product.Variants.Count == 0)
            return Problem("Product needs at least one variant before it can be published.",
                statusCode: StatusCodes.Status409Conflict);

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
        if (target == from) return NoContent();

        product.Status = target;
        product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(
            target == ProductStatus.Pending ? "product.submit_for_review" : "product.publish",
            nameof(Product),
            product.Id,
            new { from = from.ToString(), to = target.ToString() },
            cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:guid}/hide")]
    public async Task<ActionResult> Hide(Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (product is null) return NotFound();
        if (!memberships.IsActiveMemberOf(product.SupplierId)) return Forbid();
        if (product.Status == ProductStatus.Removed)
            return Problem("Removed products cannot be hidden.", statusCode: StatusCodes.Status409Conflict);
        if (product.Status == ProductStatus.Hidden) return NoContent();

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
        return NoContent();
    }

    [HttpPost("{id:guid}/remove")]
    public async Task<ActionResult> Remove(Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (product is null) return NotFound();
        if (!memberships.IsActiveMemberOf(product.SupplierId)) return Forbid();
        if (product.Status == ProductStatus.Removed) return NoContent();

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
        return NoContent();
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

    private bool TryGetUserId(out Guid userId)
    {
        var raw = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(raw, out userId);
    }
}
