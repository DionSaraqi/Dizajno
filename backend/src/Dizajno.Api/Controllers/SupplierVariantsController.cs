using System.Security.Claims;
using Dizajno.Api.Contracts;
using Dizajno.Application.Audit;
using Dizajno.Application.Suppliers;
using Dizajno.Domain.Entities;
using Dizajno.Domain.Enums;
using Dizajno.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dizajno.Api.Controllers;

/// <summary>
/// Phase 7b — supplier-facing variant CRUD nested under products.
///
/// Variant attachment for GLB + SVG preview assets is split out into two
/// dedicated endpoints (<c>/attach-glb</c>, <c>/attach-preview</c>) because the
/// upload flow is two-step (R2 presign → finalize via <c>SupplierAssetsController</c>
/// → assetId returned). Setting the asset reference on the variant row is the
/// third step.
///
/// Detaching is the same endpoint with <c>assetId = Guid.Empty</c>.
/// </summary>
[ApiController]
[Route("api/supplier")]
[Authorize]
public sealed class SupplierVariantsController : ControllerBase
{
    private readonly DizajnoDbContext _db;
    private readonly ISupplierMembershipResolver _memberships;
    private readonly IAuditLogger _audit;

    public SupplierVariantsController(
        DizajnoDbContext db,
        ISupplierMembershipResolver memberships,
        IAuditLogger audit)
    {
        _db = db;
        _memberships = memberships;
        _audit = audit;
    }

    [HttpPost("products/{productId:guid}/variants")]
    public async Task<ActionResult<SupplierVariantDto>> Create(
        Guid productId, CreateVariantRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == productId, cancellationToken);
        if (product is null) return NotFound();
        if (!memberships.IsActiveMemberOf(product.SupplierId)) return Forbid();
        if (product.Status == ProductStatus.Removed)
            return Problem("Removed products cannot accept new variants.", statusCode: StatusCodes.Status409Conflict);

        var sku = request.Sku.Trim();
        if (await _db.ProductVariants.AnyAsync(v => v.Sku == sku, cancellationToken))
            return Problem("SKU already in use.", statusCode: StatusCodes.Status409Conflict);

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

        return StatusCode(StatusCodes.Status201Created, ToDto(variant, null, null));
    }

    [HttpPut("variants/{id:guid}")]
    public async Task<ActionResult<SupplierVariantDto>> Update(
        Guid id, UpdateVariantRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var variant = await _db.ProductVariants
            .Include(v => v.Product)
            .Include(v => v.GlbAsset)
            .Include(v => v.SvgPreviewAsset)
            .FirstOrDefaultAsync(v => v.Id == id, cancellationToken);
        if (variant is null) return NotFound();
        if (!memberships.IsActiveMemberOf(variant.Product.SupplierId)) return Forbid();
        if (variant.Product.Status == ProductStatus.Removed)
            return Problem("Variant's product is removed.", statusCode: StatusCodes.Status409Conflict);

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

        return Ok(ToDto(variant, variant.GlbAsset, variant.SvgPreviewAsset));
    }

    [HttpDelete("variants/{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var variant = await _db.ProductVariants
            .Include(v => v.Product)
            .FirstOrDefaultAsync(v => v.Id == id, cancellationToken);
        if (variant is null) return NotFound();
        if (!memberships.IsActiveMemberOf(variant.Product.SupplierId)) return Forbid();

        // QuoteLines already snapshot the variant via variant_snapshot jsonb so
        // historical quotes survive deletion. PlacedItems / Openings / Walls /
        // Floors reference variants by FK — if any of those exist, hard delete
        // would FK-fail at SaveChanges. Surface that as a friendlier 409.
        var hasScene = await _db.PlacedItems.AnyAsync(p => p.ProductVariantId == id, cancellationToken)
            || await _db.Openings.AnyAsync(o => o.ProductVariantId == id, cancellationToken)
            || await _db.Walls.AnyAsync(w => w.PaintProductVariantId == id, cancellationToken)
            || await _db.Floors.AnyAsync(f => f.FlooringProductVariantId == id, cancellationToken);
        if (hasScene)
            return Problem(
                "Variant is referenced by existing project scenes. Hide the product instead of deleting the variant.",
                statusCode: StatusCodes.Status409Conflict);

        _db.ProductVariants.Remove(variant);
        variant.Product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("variants/{id:guid}/attach-glb")]
    public async Task<ActionResult> AttachGlb(
        Guid id, AttachVariantAssetRequest request, CancellationToken cancellationToken)
    {
        return await AttachAssetAsync(id, request.AssetId, AssetKind.Glb, cancellationToken);
    }

    [HttpPost("variants/{id:guid}/attach-preview")]
    public async Task<ActionResult> AttachPreview(
        Guid id, AttachVariantAssetRequest request, CancellationToken cancellationToken)
    {
        return await AttachAssetAsync(id, request.AssetId, AssetKind.SvgPreview, cancellationToken);
    }

    private async Task<ActionResult> AttachAssetAsync(
        Guid variantId, Guid assetId, AssetKind expectedKind, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var variant = await _db.ProductVariants
            .Include(v => v.Product)
            .FirstOrDefaultAsync(v => v.Id == variantId, cancellationToken);
        if (variant is null) return NotFound();
        if (!memberships.IsActiveMemberOf(variant.Product.SupplierId)) return Forbid();

        // Detach: passing Guid.Empty clears the link without requiring a real asset.
        if (assetId == Guid.Empty)
        {
            if (expectedKind == AssetKind.Glb) variant.GlbAssetId = null;
            else variant.SvgPreviewAssetId = null;
            variant.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(cancellationToken);
            return NoContent();
        }

        var asset = await _db.Assets.FirstOrDefaultAsync(a => a.Id == assetId, cancellationToken);
        if (asset is null) return Problem("Asset not found.", statusCode: StatusCodes.Status400BadRequest);
        if (asset.OwnerSupplierId != variant.Product.SupplierId)
            return Problem("Asset belongs to a different supplier.", statusCode: StatusCodes.Status400BadRequest);
        if (asset.Kind != expectedKind)
            return Problem($"Asset kind must be {expectedKind} (got {asset.Kind}).",
                statusCode: StatusCodes.Status400BadRequest);

        if (expectedKind == AssetKind.Glb) variant.GlbAssetId = assetId;
        else variant.SvgPreviewAssetId = assetId;
        variant.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static SupplierVariantDto ToDto(ProductVariant v, Asset? glb, Asset? svg) => new(
        v.Id, v.ProductId, v.Sku, v.Name, v.Width, v.Depth, v.Height,
        v.Color, v.BasePrice, v.Currency,
        v.GlbAssetId, glb?.Url,
        v.SvgPreviewAssetId, svg?.Url,
        v.CollisionBoxes, v.MaterialDefaults, v.Attributes,
        v.SortOrder, v.CreatedAt, v.UpdatedAt);

    private bool TryGetUserId(out Guid userId)
    {
        var raw = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(raw, out userId);
    }
}
