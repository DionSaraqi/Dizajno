using System.Security.Claims;
using Dizajno.Dto.Supplier;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Application.Interfaces;

public interface ISupplierTextureService
{
    Task<ActionResult<IReadOnlyList<SupplierTextureDto>>> ListAsync(
        Guid? supplierId,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult<SupplierTextureDto>> CreateAsync(
        CreateTextureRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult<SupplierTextureDto>> UpdateAsync(
        Guid id,
        UpdateTextureRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult> DeleteAsync(
        Guid id,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult<IReadOnlyList<VariantTextureSlotDto>>> ListSlotsAsync(
        Guid variantId,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult<IReadOnlyList<VariantTextureSlotDto>>> ReplaceSlotsAsync(
        Guid variantId,
        ReplaceVariantTextureSlotsRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);
}
