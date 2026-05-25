using Dizajno.Application.Interfaces;
using Dizajno.Dto.Supplier;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

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
    private readonly ISupplierVariantService _service;

    public SupplierVariantsController(ISupplierVariantService service) => _service = service;

    [HttpPost("products/{productId:guid}/variants")]
    public Task<ActionResult<SupplierVariantDto>> Create(
        Guid productId, CreateVariantRequest request, CancellationToken cancellationToken)
        => _service.CreateAsync(productId, request, User, cancellationToken);

    [HttpPut("variants/{id:guid}")]
    public Task<ActionResult<SupplierVariantDto>> Update(
        Guid id, UpdateVariantRequest request, CancellationToken cancellationToken)
        => _service.UpdateAsync(id, request, User, cancellationToken);

    [HttpDelete("variants/{id:guid}")]
    public Task<ActionResult> Delete(Guid id, CancellationToken cancellationToken)
        => _service.DeleteAsync(id, User, cancellationToken);

    [HttpPost("variants/{id:guid}/attach-glb")]
    public Task<ActionResult> AttachGlb(
        Guid id, AttachVariantAssetRequest request, CancellationToken cancellationToken)
        => _service.AttachGlbAsync(id, request, User, cancellationToken);

    [HttpPost("variants/{id:guid}/attach-preview")]
    public Task<ActionResult> AttachPreview(
        Guid id, AttachVariantAssetRequest request, CancellationToken cancellationToken)
        => _service.AttachPreviewAsync(id, request, User, cancellationToken);
}
