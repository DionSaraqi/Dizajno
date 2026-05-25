using System.Security.Claims;
using Dizajno.Dto.Admin;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Application.Interfaces;

public interface ISupplierInviteService
{
    Task<ActionResult<IReadOnlyList<SupplierInviteDto>>> ListAsync(
        Guid supplierId,
        bool includeRevoked,
        bool includeAccepted,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult<SupplierInviteDto>> CreateAsync(
        CreateSupplierInviteRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult> RevokeAsync(
        Guid id,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);
}
