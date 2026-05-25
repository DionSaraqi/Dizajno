using System.Security.Claims;
using Dizajno.Dto.Admin;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Application.Interfaces;

public interface IInviteService
{
    Task<ActionResult<InvitePreviewDto>> PreviewAsync(string token, CancellationToken cancellationToken);

    Task<ActionResult> AcceptAsync(string token, ClaimsPrincipal user, CancellationToken cancellationToken);
}
