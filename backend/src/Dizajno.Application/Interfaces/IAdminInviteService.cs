using System.Security.Claims;
using Dizajno.Dto.Admin;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Application.Interfaces;

public interface IAdminInviteService
{
    Task<ActionResult<IReadOnlyList<SupplierInviteDto>>> ListAsync(
        Guid? supplierId,
        bool includeRevoked,
        bool includeAccepted,
        CancellationToken cancellationToken);

    Task<ActionResult<SupplierInviteDto>> CreateAsync(
        CreateSupplierInviteRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult> RevokeAsync(Guid id, CancellationToken cancellationToken);
}
