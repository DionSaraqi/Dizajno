using Dizajno.Application.Interfaces;
using Dizajno.Dto.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Api.Controllers;

/// <summary>
/// Admin endpoints for issuing supplier invites. The raw token returned on
/// create is the only chance to capture it — the DB stores a SHA-256 hash and
/// the response also includes a ready-made <c>AcceptUrl</c> built from
/// <see cref="Dizajno.Application.Options.InviteOptions.AcceptUrlTemplate"/> so the admin can copy/paste
/// straight into Slack/email/etc.
/// </summary>
[ApiController]
[Route("api/admin/invites")]
[Authorize(Roles = "Admin")]
public sealed class AdminInvitesController : ControllerBase
{
    private readonly IAdminInviteService _service;

    public AdminInvitesController(IAdminInviteService service) => _service = service;

    [HttpGet]
    public Task<ActionResult<IReadOnlyList<SupplierInviteDto>>> List(
        CancellationToken cancellationToken,
        [FromQuery] Guid? supplierId = null,
        [FromQuery] bool includeRevoked = false,
        [FromQuery] bool includeAccepted = true)
        => _service.ListAsync(supplierId, includeRevoked, includeAccepted, cancellationToken);

    [HttpPost]
    public Task<ActionResult<SupplierInviteDto>> Create(
        CreateSupplierInviteRequest request, CancellationToken cancellationToken)
        => _service.CreateAsync(request, User, cancellationToken);

    [HttpDelete("{id:guid}")]
    public Task<ActionResult> Revoke(Guid id, CancellationToken cancellationToken)
        => _service.RevokeAsync(id, cancellationToken);
}
