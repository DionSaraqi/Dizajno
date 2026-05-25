using Dizajno.Application.Interfaces;
using Dizajno.Dto.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Api.Controllers;

/// <summary>
/// Public-side invite handling. Preview is anonymous (so the invite-accept
/// page can render the supplier name + role before forcing login); accept
/// requires a signed-in user and binds them as a <see cref="Dizajno.Domain.Entities.SupplierMember"/>.
/// Existing memberships are honoured idempotently — re-accepting an already
/// accepted invite is a no-op.
/// </summary>
[ApiController]
[Route("api/invites")]
public sealed class InvitesController : ControllerBase
{
    private readonly IInviteService _service;

    public InvitesController(IInviteService service)
    {
        _service = service;
    }

    [HttpGet("{token}")]
    [AllowAnonymous]
    public Task<ActionResult<InvitePreviewDto>> Preview(string token, CancellationToken cancellationToken) =>
        _service.PreviewAsync(token, cancellationToken);

    [HttpPost("{token}/accept")]
    [Authorize]
    public Task<ActionResult> Accept(string token, CancellationToken cancellationToken) =>
        _service.AcceptAsync(token, User, cancellationToken);
}
