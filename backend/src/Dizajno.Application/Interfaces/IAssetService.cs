using Dizajno.Dto.Asset;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Application.Interfaces;

public interface IAssetService
{
    Task<ActionResult<PresignAssetUploadResponse>> PresignAsync(
        PresignAssetUploadRequest request,
        CancellationToken cancellationToken);

    Task<ActionResult<AssetDto>> CreateAsync(
        CreateAssetRequest request,
        CancellationToken cancellationToken);
}
