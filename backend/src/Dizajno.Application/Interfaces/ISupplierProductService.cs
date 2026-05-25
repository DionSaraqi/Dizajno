using System.Security.Claims;
using Dizajno.Domain.Enums;
using Dizajno.Dto.Supplier;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Application.Interfaces;

public interface ISupplierProductService
{
    Task<ActionResult<IReadOnlyList<SupplierProductSummaryDto>>> ListAsync(
        ClaimsPrincipal user,
        Guid? supplierId,
        ProductStatus? status,
        string? search,
        CancellationToken cancellationToken);

    Task<ActionResult<SupplierProductDetailDto>> GetAsync(
        Guid id,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult<SupplierProductDetailDto>> CreateAsync(
        CreateProductRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult<SupplierProductDetailDto>> UpdateAsync(
        Guid id,
        UpdateProductRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult> PublishAsync(
        Guid id,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult> HideAsync(
        Guid id,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult> RemoveAsync(
        Guid id,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);
}
