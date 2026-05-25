using Dizajno.Application.Interfaces;
using Dizajno.Domain.Entities;
using Dizajno.Domain.Enums;
using Dizajno.Dto.Supplier;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Api.Controllers;

/// <summary>
/// Phase 7b — supplier-owned texture library + per-variant slot bindings.
///
/// Two surfaces:
/// <list type="bullet">
///   <item><c>/api/supplier/textures</c> — library CRUD. Texture rows reference an <see cref="Asset"/> uploaded via the
///         supplier asset presign flow (kind = <see cref="AssetKind.Image"/>).</item>
///   <item><c>/api/supplier/variants/{id}/texture-slots</c> — full replacement of a variant's slot bindings (one row per
///         (slotName, supplierTextureId) pair, with one optionally flagged <c>IsDefault</c>). Replacing is simpler than
///         diffing — matches the edit-and-save UX. The Postgres trigger <c>trg_pv_texture_slot_supplier_match</c>
///         enforces cross-supplier isolation, but the controller fails fast with a 400 before reaching SQL.</item>
/// </list>
/// </summary>
[ApiController]
[Route("api/supplier")]
[Authorize]
public sealed class SupplierTexturesController : ControllerBase
{
    private readonly ISupplierTextureService _service;

    public SupplierTexturesController(ISupplierTextureService service) => _service = service;

    // ── Library CRUD ────────────────────────────────────────────────────────

    [HttpGet("textures")]
    public Task<ActionResult<IReadOnlyList<SupplierTextureDto>>> List(
        CancellationToken cancellationToken,
        [FromQuery] Guid? supplierId = null)
        => _service.ListAsync(supplierId, User, cancellationToken);

    [HttpPost("textures")]
    public Task<ActionResult<SupplierTextureDto>> Create(
        CreateTextureRequest request, CancellationToken cancellationToken)
        => _service.CreateAsync(request, User, cancellationToken);

    [HttpPut("textures/{id:guid}")]
    public Task<ActionResult<SupplierTextureDto>> Update(
        Guid id, UpdateTextureRequest request, CancellationToken cancellationToken)
        => _service.UpdateAsync(id, request, User, cancellationToken);

    [HttpDelete("textures/{id:guid}")]
    public Task<ActionResult> Delete(Guid id, CancellationToken cancellationToken)
        => _service.DeleteAsync(id, User, cancellationToken);

    // ── Variant slot bindings ──────────────────────────────────────────────

    [HttpGet("variants/{variantId:guid}/texture-slots")]
    public Task<ActionResult<IReadOnlyList<VariantTextureSlotDto>>> ListSlots(
        Guid variantId, CancellationToken cancellationToken)
        => _service.ListSlotsAsync(variantId, User, cancellationToken);

    [HttpPut("variants/{variantId:guid}/texture-slots")]
    public Task<ActionResult<IReadOnlyList<VariantTextureSlotDto>>> ReplaceSlots(
        Guid variantId, ReplaceVariantTextureSlotsRequest request, CancellationToken cancellationToken)
        => _service.ReplaceSlotsAsync(variantId, request, User, cancellationToken);
}
