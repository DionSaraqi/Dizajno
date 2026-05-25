using System.Security.Claims;
using Dizajno.Dto.Admin;
using Dizajno.Dto.Asset;
using Dizajno.Dto.Auth;
using Dizajno.Dto.Catalog;
using Dizajno.Dto.Project;
using Dizajno.Dto.Quote;
using Dizajno.Dto.Share;
using Dizajno.Dto.Supplier;
using Dizajno.Application.Interfaces;
using Dizajno.Domain.Entities;
using Dizajno.Domain.Enums;
using Dizajno.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dizajno.Api.Controllers;

/// <summary>
/// Phase 7b â€” supplier-owned texture library + per-variant slot bindings.
///
/// Two surfaces:
/// <list type="bullet">
///   <item><c>/api/supplier/textures</c> â€” library CRUD. Texture rows reference an <see cref="Asset"/> uploaded via the
///         supplier asset presign flow (kind = <see cref="AssetKind.Image"/>).</item>
///   <item><c>/api/supplier/variants/{id}/texture-slots</c> â€” full replacement of a variant's slot bindings (one row per
///         (slotName, supplierTextureId) pair, with one optionally flagged <c>IsDefault</c>). Replacing is simpler than
///         diffing â€” matches the edit-and-save UX. The Postgres trigger <c>trg_pv_texture_slot_supplier_match</c>
///         enforces cross-supplier isolation, but the controller fails fast with a 400 before reaching SQL.</item>
/// </list>
/// </summary>
[ApiController]
[Route("api/supplier")]
[Authorize]
public sealed class SupplierTexturesController : ControllerBase
{
    private readonly DizajnoDbContext _db;
    private readonly ISupplierMembershipResolver _memberships;

    public SupplierTexturesController(
        DizajnoDbContext db, ISupplierMembershipResolver memberships)
    {
        _db = db;
        _memberships = memberships;
    }

    // â”€â”€ Library CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    [HttpGet("textures")]
    public async Task<ActionResult<IReadOnlyList<SupplierTextureDto>>> List(
        CancellationToken cancellationToken,
        [FromQuery] Guid? supplierId = null)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);
        var supplierIds = memberships.ActiveSupplierIds();
        if (supplierIds.Count == 0) return Forbid();
        if (supplierId is { } target)
        {
            if (!supplierIds.Contains(target)) return Forbid();
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
        return Ok(rows);
    }

    [HttpPost("textures")]
    public async Task<ActionResult<SupplierTextureDto>> Create(
        CreateTextureRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);
        if (!memberships.IsActiveMemberOf(request.SupplierId)) return Forbid();

        // Both referenced assets must belong to this supplier â€” otherwise
        // anyone could attach somebody else's image to their library.
        var assetOk = await _db.Assets.AnyAsync(
            a => a.Id == request.AssetId && a.OwnerSupplierId == request.SupplierId && a.Kind == AssetKind.Image,
            cancellationToken);
        if (!assetOk)
            return Problem("Asset not found, wrong kind, or belongs to a different supplier.",
                statusCode: StatusCodes.Status400BadRequest);
        if (request.ThumbnailAssetId is { } tid)
        {
            var thumbOk = await _db.Assets.AnyAsync(
                a => a.Id == tid && a.OwnerSupplierId == request.SupplierId && a.Kind == AssetKind.Image,
                cancellationToken);
            if (!thumbOk)
                return Problem("Thumbnail asset not found or belongs to a different supplier.",
                    statusCode: StatusCodes.Status400BadRequest);
        }
        if (await _db.SupplierTextures.AnyAsync(
            t => t.SupplierId == request.SupplierId && t.Name == request.Name.Trim(), cancellationToken))
            return Problem("Texture name already in use within this supplier.",
                statusCode: StatusCodes.Status409Conflict);

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

        return StatusCode(StatusCodes.Status201Created, await ReadDtoAsync(texture.Id, cancellationToken));
    }

    [HttpPut("textures/{id:guid}")]
    public async Task<ActionResult<SupplierTextureDto>> Update(
        Guid id, UpdateTextureRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var texture = await _db.SupplierTextures.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        if (texture is null) return NotFound();
        if (!memberships.IsActiveMemberOf(texture.SupplierId)) return Forbid();

        if (request.ThumbnailAssetId is { } tid)
        {
            var thumbOk = await _db.Assets.AnyAsync(
                a => a.Id == tid && a.OwnerSupplierId == texture.SupplierId && a.Kind == AssetKind.Image,
                cancellationToken);
            if (!thumbOk)
                return Problem("Thumbnail asset not found or belongs to a different supplier.",
                    statusCode: StatusCodes.Status400BadRequest);
        }
        var newName = request.Name.Trim();
        if (newName != texture.Name && await _db.SupplierTextures.AnyAsync(
            t => t.SupplierId == texture.SupplierId && t.Name == newName && t.Id != id, cancellationToken))
            return Problem("Texture name already in use within this supplier.",
                statusCode: StatusCodes.Status409Conflict);

        texture.Name = newName;
        texture.ThumbnailAssetId = request.ThumbnailAssetId;
        texture.Tags = request.Tags?.ToArray() ?? texture.Tags;
        if (request.RepeatU is { } u) texture.RepeatU = Math.Clamp(u, 1, 32);
        if (request.RepeatV is { } v) texture.RepeatV = Math.Clamp(v, 1, 32);
        await _db.SaveChangesAsync(cancellationToken);

        return Ok(await ReadDtoAsync(texture.Id, cancellationToken));
    }

    [HttpDelete("textures/{id:guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var texture = await _db.SupplierTextures.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        if (texture is null) return NotFound();
        if (!memberships.IsActiveMemberOf(texture.SupplierId)) return Forbid();

        // FK from product_variant_texture_slots is RESTRICT, so a hard delete
        // would SQL-error if any slot still references this texture. Surface a
        // 409 with a friendlier message; the supplier must clear slot bindings
        // before deleting.
        var used = await _db.ProductVariantTextureSlots.AnyAsync(s => s.SupplierTextureId == id, cancellationToken);
        if (used)
            return Problem(
                "Texture is bound to one or more variant slots. Remove those bindings first.",
                statusCode: StatusCodes.Status409Conflict);

        _db.SupplierTextures.Remove(texture);
        await _db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    // â”€â”€ Variant slot bindings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    [HttpGet("variants/{variantId:guid}/texture-slots")]
    public async Task<ActionResult<IReadOnlyList<VariantTextureSlotDto>>> ListSlots(
        Guid variantId, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var variant = await _db.ProductVariants
            .AsNoTracking()
            .Include(v => v.Product)
            .FirstOrDefaultAsync(v => v.Id == variantId, cancellationToken);
        if (variant is null) return NotFound();
        if (!memberships.IsActiveMemberOf(variant.Product.SupplierId)) return Forbid();

        var rows = await _db.ProductVariantTextureSlots
            .AsNoTracking()
            .Where(s => s.VariantId == variantId)
            .OrderBy(s => s.SlotName).ThenBy(s => s.SupplierTexture.Name)
            .Select(s => new VariantTextureSlotDto(
                s.Id, s.VariantId, s.SlotName,
                s.SupplierTextureId, s.SupplierTexture.Name,
                s.SupplierTexture.Asset.Url, s.IsDefault))
            .ToListAsync(cancellationToken);
        return Ok(rows);
    }

    [HttpPut("variants/{variantId:guid}/texture-slots")]
    public async Task<ActionResult<IReadOnlyList<VariantTextureSlotDto>>> ReplaceSlots(
        Guid variantId, ReplaceVariantTextureSlotsRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);

        var variant = await _db.ProductVariants
            .Include(v => v.Product)
            .FirstOrDefaultAsync(v => v.Id == variantId, cancellationToken);
        if (variant is null) return NotFound();
        if (!memberships.IsActiveMemberOf(variant.Product.SupplierId)) return Forbid();

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
            return Problem(
                $"Texture(s) {string.Join(", ", missing)} do not belong to this supplier.",
                statusCode: StatusCodes.Status400BadRequest);

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
        return Ok(rows);
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

    private bool TryGetUserId(out Guid userId)
    {
        var raw = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(raw, out userId);
    }
}
