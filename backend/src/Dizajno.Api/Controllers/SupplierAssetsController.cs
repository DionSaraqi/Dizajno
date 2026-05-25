using Dizajno.Application.Interfaces;
using Dizajno.Dto.Asset;
using Dizajno.Dto.Supplier;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Api.Controllers;

/// <summary>
/// Phase 5 — supplier-scoped wrapper around the R2 presign + finalize flow.
/// Mirrors <see cref="AssetsController"/> but takes the supplier id from the
/// request and validates it against the caller's <see cref="ISupplierMembershipResolver"/>
/// results instead of requiring the Admin role. Phase 7's portal reuses this
/// path for product uploads.
/// </summary>
[ApiController]
[Route("api/supplier/assets")]
[Authorize]
public sealed class SupplierAssetsController : ControllerBase
{
    private readonly ISupplierAssetService _service;

    public SupplierAssetsController(ISupplierAssetService service) => _service = service;

    [HttpPost("presign")]
    public Task<ActionResult<PresignAssetUploadResponse>> Presign(
        PresignSupplierAssetRequest request,
        CancellationToken cancellationToken)
        => _service.PresignAsync(request, User, cancellationToken);

    [HttpPost]
    public Task<ActionResult<AssetDto>> Create(
        CreateSupplierAssetRequest request,
        CancellationToken cancellationToken)
        => _service.CreateAsync(request, User, cancellationToken);
}
