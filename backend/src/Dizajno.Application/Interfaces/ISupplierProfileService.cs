using System.Security.Claims;
using Dizajno.Dto.Supplier;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Application.Interfaces;

public interface ISupplierProfileService
{
    Task<ActionResult<SupplierProfileDto>> GetAsync(
        Guid supplierId,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult<SupplierProfileDto>> UpdateAsync(
        Guid supplierId,
        UpdateProfileRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);
}
