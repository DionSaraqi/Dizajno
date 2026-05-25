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

public sealed class SupplierVariantService : ISupplierVariantService
{
    private readonly DizajnoDbContext _db;
    private readonly ISupplierMembershipResolver _memberships;
    private readonly IAuditLogger _audit;

    public SupplierVariantService(
        DizajnoDbContext db,
        ISupplierMembershipResolver memberships,
        IAuditLogger audit)
    {
        _db = db;
        _memberships = memberships;
        _audit = audit;
    }

    public async Task<ActionResult<SupplierVariantDto>> CreateAsync(
        Guid productId, CreateVariantRequest request, ClaimsPrincipal user, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == productId, cancellationToken);
        if (product is null) return new NotFoundResult();
        if (!memberships.IsActiveMemberOf(product.SupplierId)) return new ForbidResult();
        if (product.Status == ProductStatus.Removed)
            return new ObjectResult(new ProblemDetails { Detail = "Removed products cannot accept new variants.", Status = StatusCodes.Status409Conflict }) { StatusCode = StatusCodes.Status409Conflict };

        var sku = request.Sku.Trim();
        if (await _db.ProductVariants.AnyAsync(v => v.Sku == sku, cancellationToken))
            return new ObjectResult(new ProblemDetails { Detail = "SKU already in use.", Status = StatusCodes.Status409Conflict }) { StatusCode = StatusCodes.Status409Conflict };

        // Default SortOrder = (max + 1) so new variants land at the end of the picker.
        var nextSortOrder = request.SortOrder
            ?? (await _db.ProductVariants
                .Where(v => v.ProductId == productId)
                .Select(v => (int?)v.SortOrder)
                .MaxAsync(cancellationToken) ?? -1) + 1;

        var variant = new ProductVariant
        {
            Id = Guid.NewGuid(),
            ProductId = productId,
            Sku = sku,
            Name = request.Name.Trim(),
            Width = request.Width,
            Depth = request.Depth,
            Height = request.Height,
            Color = string.IsNullOrWhiteSpace(request.Color) ? "#999999" : request.Color,
            BasePrice = request.BasePrice,
            Currency = string.IsNullOrWhiteSpace(request.Currency) ? "EUR" : request.Currency.ToUpperInvariant(),
            CollisionBoxes = request.CollisionBoxes,
            MaterialDefaults = request.MaterialDefaults,
            Attributes = string.IsNullOrWhiteSpace(request.Attributes) ? "{}" : request.Attributes,
            SortOrder = nextSortOrder,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.ProductVariants.Add(variant);
        product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        return new ObjectResult(ToDto(variant, null, null)) { StatusCode = StatusCodes.Status201Created };
    }

    public async Task<ActionResult<SupplierVariantDto>> UpdateAsync(
        Guid id, UpdateVariantRequest request, ClaimsPrincipal user, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var variant = await _db.ProductVariants
            .Include(v => v.Product)
            .Include(v => v.GlbAsset)
            .Include(v => v.SvgPreviewAsset)
            .FirstOrDefaultAsync(v => v.Id == id, cancellationToken);
        if (variant is null) return new NotFoundResult();
        if (!memberships.IsActiveMemberOf(variant.Product.SupplierId)) return new ForbidResult();
        if (variant.Product.Status == ProductStatus.Removed)
            return new ObjectResult(new ProblemDetails { Detail = "Variant's product is removed.", Status = StatusCodes.Status409Conflict }) { StatusCode = StatusCodes.Status409Conflict };

        variant.Name = request.Name.Trim();
        variant.Width = request.Width;
        variant.Depth = request.Depth;
        variant.Height = request.Height;
        variant.Color = string.IsNullOrWhiteSpace(request.Color) ? variant.Color : request.Color;
        variant.BasePrice = request.BasePrice;
        variant.Currency = string.IsNullOrWhiteSpace(request.Currency) ? variant.Currency : request.Currency.ToUpperInvariant();
        variant.CollisionBoxes = request.CollisionBoxes;
        variant.MaterialDefaults = request.MaterialDefaults;
        variant.Attributes = string.IsNullOrWhiteSpace(request.Attributes) ? "{}" : request.Attributes;
        if (request.SortOrder is { } so) variant.SortOrder = so;
        variant.UpdatedAt = DateTime.UtcNow;
        variant.Product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        return new OkObjectResult(ToDto(variant, variant.GlbAsset, variant.SvgPreviewAsset));
    }

    public async Task<ActionResult> DeleteAsync(Guid id, ClaimsPrincipal user, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var variant = await _db.ProductVariants
            .Include(v => v.Product)
            .FirstOrDefaultAsync(v => v.Id == id, cancellationToken);
        if (variant is null) return new NotFoundResult();
        if (!memberships.IsActiveMemberOf(variant.Product.SupplierId)) return new ForbidResult();

        // QuoteLines already snapshot the variant via variant_snapshot jsonb so
        // historical quotes survive deletion. PlacedItems / Openings / Walls /
        // Floors reference variants by FK — if any of those exist, hard delete
        // would FK-fail at SaveChanges. Surface that as a friendlier 409.
        var hasScene = await _db.PlacedItems.AnyAsync(p => p.ProductVariantId == id, cancellationToken)
            || await _db.Openings.AnyAsync(o => o.ProductVariantId == id, cancellationToken)
            || await _db.Walls.AnyAsync(w => w.PaintProductVariantId == id, cancellationToken)
            || await _db.Floors.AnyAsync(f => f.FlooringProductVariantId == id, cancellationToken);
        if (hasScene)
            return new ObjectResult(new ProblemDetails
            {
                Detail = "Variant is referenced by existing project scenes. Hide the product instead of deleting the variant.",
                Status = StatusCodes.Status409Conflict
            })
            { StatusCode = StatusCodes.Status409Conflict };

        _db.ProductVariants.Remove(variant);
        variant.Product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return new NoContentResult();
    }

    public Task<ActionResult> AttachGlbAsync(
        Guid id, AttachVariantAssetRequest request, ClaimsPrincipal user, CancellationToken cancellationToken)
    {
        return AttachAssetAsync(id, request.AssetId, AssetKind.Glb, user, cancellationToken);
    }

    public Task<ActionResult> AttachPreviewAsync(
        Guid id, AttachVariantAssetRequest request, ClaimsPrincipal user, CancellationToken cancellationToken)
    {
        return AttachAssetAsync(id, request.AssetId, AssetKind.SvgPreview, user, cancellationToken);
    }

    private async Task<ActionResult> AttachAssetAsync(
        Guid variantId, Guid assetId, AssetKind expectedKind, ClaimsPrincipal user, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var variant = await _db.ProductVariants
            .Include(v => v.Product)
            .FirstOrDefaultAsync(v => v.Id == variantId, cancellationToken);
        if (variant is null) return new NotFoundResult();
        if (!memberships.IsActiveMemberOf(variant.Product.SupplierId)) return new ForbidResult();

        // Detach: passing Guid.Empty clears the link without requiring a real asset.
        if (assetId == Guid.Empty)
        {
            if (expectedKind == AssetKind.Glb) variant.GlbAssetId = null;
            else variant.SvgPreviewAssetId = null;
            variant.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(cancellationToken);
            return new NoContentResult();
        }

        var asset = await _db.Assets.FirstOrDefaultAsync(a => a.Id == assetId, cancellationToken);
        if (asset is null) return new ObjectResult(new ProblemDetails { Detail = "Asset not found.", Status = StatusCodes.Status400BadRequest }) { StatusCode = StatusCodes.Status400BadRequest };
        if (asset.OwnerSupplierId != variant.Product.SupplierId)
            return new ObjectResult(new ProblemDetails { Detail = "Asset belongs to a different supplier.", Status = StatusCodes.Status400BadRequest }) { StatusCode = StatusCodes.Status400BadRequest };
        if (asset.Kind != expectedKind)
            return new ObjectResult(new ProblemDetails { Detail = $"Asset kind must be {expectedKind} (got {asset.Kind}).", Status = StatusCodes.Status400BadRequest }) { StatusCode = StatusCodes.Status400BadRequest };

        if (expectedKind == AssetKind.Glb) variant.GlbAssetId = assetId;
        else variant.SvgPreviewAssetId = assetId;
        variant.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return new NoContentResult();
    }

    private static SupplierVariantDto ToDto(ProductVariant v, Asset? glb, Asset? svg) => new(
        v.Id, v.ProductId, v.Sku, v.Name, v.Width, v.Depth, v.Height,
        v.Color, v.BasePrice, v.Currency,
        v.GlbAssetId, glb?.Url,
        v.SvgPreviewAssetId, svg?.Url,
        v.CollisionBoxes, v.MaterialDefaults, v.Attributes,
        v.SortOrder, v.CreatedAt, v.UpdatedAt);

    private static bool TryGetUserId(ClaimsPrincipal user, out Guid userId)
    {
        var raw = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? user.FindFirst("sub")?.Value;
        return Guid.TryParse(raw, out userId);
    }
}
