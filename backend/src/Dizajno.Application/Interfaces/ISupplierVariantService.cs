using System.Security.Claims;
using Dizajno.Dto.Supplier;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Application.Interfaces;

public interface ISupplierVariantService
{
    Task<ActionResult<SupplierVariantDto>> CreateAsync(
        Guid productId,
        CreateVariantRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult<SupplierVariantDto>> UpdateAsync(
        Guid id,
        UpdateVariantRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult> DeleteAsync(
        Guid id,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult> AttachGlbAsync(
        Guid id,
        AttachVariantAssetRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult> AttachPreviewAsync(
        Guid id,
        AttachVariantAssetRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);
}
