using System.Security.Claims;
using Dizajno.Dto.Supplier;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Application.Interfaces;

public interface ISupplierCategoryService
{
    Task<ActionResult<IReadOnlyList<SuggestedCategoryDto>>> ListAsync(
        ClaimsPrincipal user,
        Guid? supplierId,
        CancellationToken cancellationToken);

    Task<ActionResult<SuggestedCategoryDto>> SuggestAsync(
        SuggestCategoryRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);
}
