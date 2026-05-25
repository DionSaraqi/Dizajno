using System.Security.Claims;
using Dizajno.Dto.Asset;
using Dizajno.Dto.Supplier;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Application.Interfaces;

public interface ISupplierAssetService
{
    Task<ActionResult<PresignAssetUploadResponse>> PresignAsync(
        PresignSupplierAssetRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult<AssetDto>> CreateAsync(
        CreateSupplierAssetRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);
}
