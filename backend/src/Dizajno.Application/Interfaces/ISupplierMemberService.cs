using System.Security.Claims;
using Dizajno.Dto.Supplier;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Application.Interfaces;

public interface ISupplierMemberService
{
    Task<ActionResult<IReadOnlyList<SupplierMemberSummaryDto>>> ListAsync(
        Guid supplierId,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult> ChangeRoleAsync(
        Guid id,
        ChangeMemberRoleRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult> RemoveAsync(
        Guid id,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);
}
