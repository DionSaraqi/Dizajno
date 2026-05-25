using Dizajno.Application.Interfaces;
using Dizajno.Dto.Asset;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Api.Controllers;

/// <summary>
/// Admin-only endpoints for issuing presigned R2 upload URLs and registering
/// the resulting <see cref="Domain.Entities.Asset"/> rows. Once a supplier portal ships (Phase 7),
/// supplier-scoped variants of these endpoints live alongside.
/// </summary>
[ApiController]
[Route("api/admin/assets")]
[Authorize(Roles = "Admin")]
public sealed class AssetsController : ControllerBase
{
    private readonly IAssetService _service;

    public AssetsController(IAssetService service) => _service = service;

    [HttpPost("presign")]
    public Task<ActionResult<PresignAssetUploadResponse>> Presign(
        PresignAssetUploadRequest request,
        CancellationToken cancellationToken)
        => _service.PresignAsync(request, cancellationToken);

    [HttpPost]
    public Task<ActionResult<AssetDto>> Create(
        CreateAssetRequest request,
        CancellationToken cancellationToken)
        => _service.CreateAsync(request, cancellationToken);
}
