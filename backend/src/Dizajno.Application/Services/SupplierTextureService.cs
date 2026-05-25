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

public sealed class SupplierTextureService : ISupplierTextureService
{
    private readonly DizajnoDbContext _db;
    private readonly ISupplierMembershipResolver _memberships;

    public SupplierTextureService(
        DizajnoDbContext db, ISupplierMembershipResolver memberships)
    {
        _db = db;
        _memberships = memberships;
    }

    // ── Library CRUD ────────────────────────────────────────────────────────

    public async Task<ActionResult<IReadOnlyList<SupplierTextureDto>>> ListAsync(
        Guid? supplierId,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);
        var supplierIds = memberships.ActiveSupplierIds();
        if (supplierIds.Count == 0) return new ForbidResult();
        if (supplierId is { } target)
        {
            if (!supplierIds.Contains(target)) return new ForbidResult();
            supplierIds = new HashSet<Guid> { target };
        }

        var rows = await _db.SupplierTextures
            .AsNoTracking()
            .Where(t => supplierIds.Contains(t.SupplierId))
            .OrderBy(t => t.Name)
            .Select(t => new SupplierTextureDto(
                t.Id, t.SupplierId, t.Name,
                t.AssetId, t.Asset.Url,
                t.ThumbnailAssetId, t.ThumbnailAsset != null ? t.ThumbnailAsset.Url : null,
                t.Tags,
                t.RepeatU, t.RepeatV,
                _db.ProductVariantTextureSlots.Count(s => s.SupplierTextureId == t.Id),
                t.CreatedAt))
            .ToListAsync(cancellationToken);
        return new OkObjectResult(rows);
    }

    public async Task<ActionResult<SupplierTextureDto>> CreateAsync(
        CreateTextureRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);
        if (!memberships.IsActiveMemberOf(request.SupplierId)) return new ForbidResult();

        // Both referenced assets must belong to this supplier — otherwise
        // anyone could attach somebody else's image to their library.
        var assetOk = await _db.Assets.AnyAsync(
            a => a.Id == request.AssetId && a.OwnerSupplierId == request.SupplierId && a.Kind == AssetKind.Image,
            cancellationToken);
        if (!assetOk)
            return new ObjectResult(new ProblemDetails
            {
                Detail = "Asset not found, wrong kind, or belongs to a different supplier.",
                Status = StatusCodes.Status400BadRequest
            })
            { StatusCode = StatusCodes.Status400BadRequest };
        if (request.ThumbnailAssetId is { } tid)
        {
            var thumbOk = await _db.Assets.AnyAsync(
                a => a.Id == tid && a.OwnerSupplierId == request.SupplierId && a.Kind == AssetKind.Image,
                cancellationToken);
            if (!thumbOk)
                return new ObjectResult(new ProblemDetails
                {
                    Detail = "Thumbnail asset not found or belongs to a different supplier.",
                    Status = StatusCodes.Status400BadRequest
                })
                { StatusCode = StatusCodes.Status400BadRequest };
        }
        if (await _db.SupplierTextures.AnyAsync(
            t => t.SupplierId == request.SupplierId && t.Name == request.Name.Trim(), cancellationToken))
            return new ObjectResult(new ProblemDetails
            {
                Detail = "Texture name already in use within this supplier.",
                Status = StatusCodes.Status409Conflict
            })
            { StatusCode = StatusCodes.Status409Conflict };

        var texture = new SupplierTexture
        {
            Id = Guid.NewGuid(),
            SupplierId = request.SupplierId,
            Name = request.Name.Trim(),
            AssetId = request.AssetId,
            ThumbnailAssetId = request.ThumbnailAssetId,
            Tags = request.Tags?.ToArray() ?? Array.Empty<string>(),
            RepeatU = Math.Clamp(request.RepeatU ?? 4, 1, 32),
            RepeatV = Math.Clamp(request.RepeatV ?? 4, 1, 32),
            CreatedAt = DateTime.UtcNow
        };
        _db.SupplierTextures.Add(texture);
        await _db.SaveChangesAsync(cancellationToken);

        return new ObjectResult(await ReadDtoAsync(texture.Id, cancellationToken)) { StatusCode = StatusCodes.Status201Created };
    }

    public async Task<ActionResult<SupplierTextureDto>> UpdateAsync(
        Guid id,
        UpdateTextureRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var texture = await _db.SupplierTextures.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        if (texture is null) return new NotFoundResult();
        if (!memberships.IsActiveMemberOf(texture.SupplierId)) return new ForbidResult();

        if (request.ThumbnailAssetId is { } tid)
        {
            var thumbOk = await _db.Assets.AnyAsync(
                a => a.Id == tid && a.OwnerSupplierId == texture.SupplierId && a.Kind == AssetKind.Image,
                cancellationToken);
            if (!thumbOk)
                return new ObjectResult(new ProblemDetails
                {
                    Detail = "Thumbnail asset not found or belongs to a different supplier.",
                    Status = StatusCodes.Status400BadRequest
                })
                { StatusCode = StatusCodes.Status400BadRequest };
        }
        var newName = request.Name.Trim();
        if (newName != texture.Name && await _db.SupplierTextures.AnyAsync(
            t => t.SupplierId == texture.SupplierId && t.Name == newName && t.Id != id, cancellationToken))
            return new ObjectResult(new ProblemDetails
            {
                Detail = "Texture name already in use within this supplier.",
                Status = StatusCodes.Status409Conflict
            })
            { StatusCode = StatusCodes.Status409Conflict };

        texture.Name = newName;
        texture.ThumbnailAssetId = request.ThumbnailAssetId;
        texture.Tags = request.Tags?.ToArray() ?? texture.Tags;
        if (request.RepeatU is { } u) texture.RepeatU = Math.Clamp(u, 1, 32);
        if (request.RepeatV is { } v) texture.RepeatV = Math.Clamp(v, 1, 32);
        await _db.SaveChangesAsync(cancellationToken);

        return new OkObjectResult(await ReadDtoAsync(texture.Id, cancellationToken));
    }

    public async Task<ActionResult> DeleteAsync(Guid id, ClaimsPrincipal user, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var texture = await _db.SupplierTextures.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        if (texture is null) return new NotFoundResult();
        if (!memberships.IsActiveMemberOf(texture.SupplierId)) return new ForbidResult();

        // FK from product_variant_texture_slots is RESTRICT, so a hard delete
        // would SQL-error if any slot still references this texture. Surface a
        // 409 with a friendlier message; the supplier must clear slot bindings
        // before deleting.
        var used = await _db.ProductVariantTextureSlots.AnyAsync(s => s.SupplierTextureId == id, cancellationToken);
        if (used)
            return new ObjectResult(new ProblemDetails
            {
                Detail = "Texture is bound to one or more variant slots. Remove those bindings first.",
                Status = StatusCodes.Status409Conflict
            })
            { StatusCode = StatusCodes.Status409Conflict };

        _db.SupplierTextures.Remove(texture);
        await _db.SaveChangesAsync(cancellationToken);
        return new NoContentResult();
    }

    // ── Variant slot bindings ──────────────────────────────────────────────

    public async Task<ActionResult<IReadOnlyList<VariantTextureSlotDto>>> ListSlotsAsync(
        Guid variantId, ClaimsPrincipal user, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var variant = await _db.ProductVariants
            .AsNoTracking()
            .Include(v => v.Product)
            .FirstOrDefaultAsync(v => v.Id == variantId, cancellationToken);
        if (variant is null) return new NotFoundResult();
        if (!memberships.IsActiveMemberOf(variant.Product.SupplierId)) return new ForbidResult();

        var rows = await _db.ProductVariantTextureSlots
            .AsNoTracking()
            .Where(s => s.VariantId == variantId)
            .OrderBy(s => s.SlotName).ThenBy(s => s.SupplierTexture.Name)
            .Select(s => new VariantTextureSlotDto(
                s.Id, s.VariantId, s.SlotName,
                s.SupplierTextureId, s.SupplierTexture.Name,
                s.SupplierTexture.Asset.Url, s.IsDefault))
            .ToListAsync(cancellationToken);
        return new OkObjectResult(rows);
    }

    public async Task<ActionResult<IReadOnlyList<VariantTextureSlotDto>>> ReplaceSlotsAsync(
        Guid variantId, ReplaceVariantTextureSlotsRequest request, ClaimsPrincipal user, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var variant = await _db.ProductVariants
            .Include(v => v.Product)
            .FirstOrDefaultAsync(v => v.Id == variantId, cancellationToken);
        if (variant is null) return new NotFoundResult();
        if (!memberships.IsActiveMemberOf(variant.Product.SupplierId)) return new ForbidResult();

        // Every referenced supplier_texture row must belong to the same supplier.
        // Fail fast here so the supplier sees a friendly 400 instead of the
        // Postgres trigger's raw exception.
        var supplierId = variant.Product.SupplierId;
        var textureIds = request.Slots.Select(s => s.SupplierTextureId).Distinct().ToList();
        var validTextureIds = await _db.SupplierTextures
            .Where(t => textureIds.Contains(t.Id) && t.SupplierId == supplierId)
            .Select(t => t.Id)
            .ToListAsync(cancellationToken);
        var missing = textureIds.Except(validTextureIds).ToList();
        if (missing.Count > 0)
            return new ObjectResult(new ProblemDetails
            {
                Detail = $"Texture(s) {string.Join(", ", missing)} do not belong to this supplier.",
                Status = StatusCodes.Status400BadRequest
            })
            { StatusCode = StatusCodes.Status400BadRequest };

        // At most one IsDefault per slot. Trim conflicts to the first one.
        var seenDefaultSlots = new HashSet<string>(StringComparer.Ordinal);
        var rowsToInsert = request.Slots.Select(s => new ProductVariantTextureSlot
        {
            Id = Guid.NewGuid(),
            VariantId = variantId,
            SlotName = s.SlotName.Trim(),
            SupplierTextureId = s.SupplierTextureId,
            IsDefault = s.IsDefault && seenDefaultSlots.Add(s.SlotName.Trim())
        }).ToList();

        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
        var existing = await _db.ProductVariantTextureSlots
            .Where(s => s.VariantId == variantId)
            .ToListAsync(cancellationToken);
        _db.ProductVariantTextureSlots.RemoveRange(existing);
        await _db.SaveChangesAsync(cancellationToken);
        _db.ProductVariantTextureSlots.AddRange(rowsToInsert);
        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        var rows = await _db.ProductVariantTextureSlots
            .AsNoTracking()
            .Where(s => s.VariantId == variantId)
            .OrderBy(s => s.SlotName).ThenBy(s => s.SupplierTexture.Name)
            .Select(s => new VariantTextureSlotDto(
                s.Id, s.VariantId, s.SlotName,
                s.SupplierTextureId, s.SupplierTexture.Name,
                s.SupplierTexture.Asset.Url, s.IsDefault))
            .ToListAsync(cancellationToken);
        return new OkObjectResult(rows);
    }

    private async Task<SupplierTextureDto> ReadDtoAsync(Guid id, CancellationToken cancellationToken) =>
        await _db.SupplierTextures
            .AsNoTracking()
            .Where(t => t.Id == id)
            .Select(t => new SupplierTextureDto(
                t.Id, t.SupplierId, t.Name,
                t.AssetId, t.Asset.Url,
                t.ThumbnailAssetId, t.ThumbnailAsset != null ? t.ThumbnailAsset.Url : null,
                t.Tags,
                t.RepeatU, t.RepeatV,
                _db.ProductVariantTextureSlots.Count(s => s.SupplierTextureId == t.Id),
                t.CreatedAt))
            .FirstAsync(cancellationToken);

    private static bool TryGetUserId(ClaimsPrincipal user, out Guid userId)
    {
        var raw = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value;
        return Guid.TryParse(raw, out userId);
    }
}
