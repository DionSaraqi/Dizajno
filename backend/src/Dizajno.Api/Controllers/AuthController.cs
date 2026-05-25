using Dizajno.Application.Interfaces;
using Dizajno.Dto.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly IAuthService _auth;

    public AuthController(IAuthService auth)
    {
        _auth = auth;
    }

    [HttpPost("register")]
    public Task<ActionResult<AuthResponse>> Register(
        RegisterRequest request,
        CancellationToken cancellationToken) =>
        _auth.RegisterAsync(request, HttpContext, cancellationToken);

    [HttpPost("login")]
    public Task<ActionResult<AuthResponse>> Login(
        LoginRequest request,
        CancellationToken cancellationToken) =>
        _auth.LoginAsync(request, HttpContext, cancellationToken);

    [HttpPost("refresh")]
    public Task<ActionResult<AuthResponse>> Refresh(CancellationToken cancellationToken) =>
        _auth.RefreshAsync(HttpContext, cancellationToken);

    [HttpPost("logout")]
    public Task<ActionResult> Logout(CancellationToken cancellationToken) =>
        _auth.LogoutAsync(HttpContext, cancellationToken);

    [HttpGet("me")]
    [Authorize]
    public Task<ActionResult<UserSummary>> Me(CancellationToken cancellationToken) =>
        _auth.MeAsync(User, cancellationToken);
}
