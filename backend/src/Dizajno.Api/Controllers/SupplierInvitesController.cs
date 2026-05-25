using Dizajno.Application.Interfaces;
using Dizajno.Dto.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Api.Controllers;

/// <summary>
/// Phase 7c â€” Owner-side invite issuance. Mirrors <see cref="AdminInvitesController"/>
/// but gated by <see cref="Dizajno.Application.Interfaces.SupplierMembershipExtensions.IsActiveOwnerOf"/>
/// instead of the Admin role, so Owners can grow their team without admin involvement.
///
/// Token persistence, hashing, AcceptUrl construction, and the public accept
/// flow at <c>/api/invites/{token}/accept</c> are all reused from Phase 7a â€”
/// the only difference is who can mint the link.
/// </summary>
[ApiController]
[Route("api/supplier/invites")]
[Authorize]
public sealed class SupplierInvitesController : ControllerBase
{
    private readonly ISupplierInviteService _service;

    public SupplierInvitesController(ISupplierInviteService service) => _service = service;

    [HttpGet]
    public Task<ActionResult<IReadOnlyList<SupplierInviteDto>>> List(
        CancellationToken cancellationToken,
        [FromQuery] Guid supplierId,
        [FromQuery] bool includeRevoked = false,
        [FromQuery] bool includeAccepted = true)
        => _service.ListAsync(supplierId, includeRevoked, includeAccepted, User, cancellationToken);

    [HttpPost]
    public Task<ActionResult<SupplierInviteDto>> Create(
        CreateSupplierInviteRequest request, CancellationToken cancellationToken)
        => _service.CreateAsync(request, User, cancellationToken);

    [HttpDelete("{id:guid}")]
    public Task<ActionResult> Revoke(Guid id, CancellationToken cancellationToken)
        => _service.RevokeAsync(id, User, cancellationToken);
}
