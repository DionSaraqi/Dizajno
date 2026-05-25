using System.Security.Claims;
using Dizajno.Dto.Auth;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Application.Interfaces;

public interface IAuthService
{
    Task<ActionResult<AuthResponse>> RegisterAsync(
        RegisterRequest request,
        HttpContext httpContext,
        CancellationToken cancellationToken);

    Task<ActionResult<AuthResponse>> LoginAsync(
        LoginRequest request,
        HttpContext httpContext,
        CancellationToken cancellationToken);

    Task<ActionResult<AuthResponse>> RefreshAsync(
        HttpContext httpContext,
        CancellationToken cancellationToken);

    Task<ActionResult> LogoutAsync(
        HttpContext httpContext,
        CancellationToken cancellationToken);

    Task<ActionResult<UserSummary>> MeAsync(
        ClaimsPrincipal user,
        CancellationToken cancellationToken);
}
