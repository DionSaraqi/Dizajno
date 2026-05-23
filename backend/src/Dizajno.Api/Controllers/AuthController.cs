using Dizajno.Api.Contracts;
using Dizajno.Application.Auth;
using Dizajno.Application.Suppliers;
using Dizajno.Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Dizajno.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private const string RefreshCookieName = "dizajno_rt";

    private readonly UserManager<ApplicationUser> _users;
    private readonly IJwtTokenService _tokens;
    private readonly ISupplierMembershipResolver _memberships;
    private readonly JwtOptions _jwt;
    private readonly IWebHostEnvironment _env;

    public AuthController(
        UserManager<ApplicationUser> users,
        IJwtTokenService tokens,
        ISupplierMembershipResolver memberships,
        IOptions<JwtOptions> jwt,
        IWebHostEnvironment env)
    {
        _users = users;
        _tokens = tokens;
        _memberships = memberships;
        _jwt = jwt.Value;
        _env = env;
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(
        RegisterRequest request,
        CancellationToken cancellationToken)
    {
        var user = new ApplicationUser
        {
            UserName = request.Email,
            Email = request.Email,
            DisplayName = request.DisplayName,
            Locale = NormalizeLocale(request.Locale),
            CreatedAt = DateTime.UtcNow
        };

        var result = await _users.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            return BadRequest(new { errors = result.Errors.Select(e => e.Description) });
        }

        var response = await IssueTokensAsync(user, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, response);
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(
        LoginRequest request,
        CancellationToken cancellationToken)
    {
        var user = await _users.FindByEmailAsync(request.Email);
        if (user is null || user.DeletedAt is not null)
        {
            return Unauthorized(new { error = "Invalid credentials." });
        }

        var passwordOk = await _users.CheckPasswordAsync(user, request.Password);
        if (!passwordOk)
        {
            return Unauthorized(new { error = "Invalid credentials." });
        }

        var response = await IssueTokensAsync(user, cancellationToken);
        return Ok(response);
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResponse>> Refresh(CancellationToken cancellationToken)
    {
        if (!Request.Cookies.TryGetValue(RefreshCookieName, out var rawToken) ||
            string.IsNullOrWhiteSpace(rawToken))
        {
            return Unauthorized(new { error = "No refresh token." });
        }

        var validation = await _tokens.ValidateRefreshTokenAsync(rawToken, cancellationToken);
        if (validation is null)
        {
            ClearRefreshCookie();
            return Unauthorized(new { error = "Invalid or expired refresh token." });
        }

        var user = await _users.FindByIdAsync(validation.UserId.ToString());
        if (user is null || user.DeletedAt is not null)
        {
            await _tokens.RevokeAsync(validation.TokenId, GetClientIp(), null, cancellationToken);
            ClearRefreshCookie();
            return Unauthorized(new { error = "User is no longer active." });
        }

        // Rotate: issue a new refresh token, revoke the old one with a link.
        var newRefresh = await _tokens.IssueRefreshTokenAsync(user.Id, GetClientIp(), cancellationToken);
        await _tokens.RevokeAsync(validation.TokenId, GetClientIp(), newRefresh.TokenId, cancellationToken);

        var roles = await _users.GetRolesAsync(user);
        var accessToken = _tokens.IssueAccessToken(user.Id, user.Email!, roles.ToList());
        var accessExpires = DateTime.UtcNow.AddMinutes(_jwt.AccessTokenLifetimeMinutes);

        SetRefreshCookie(newRefresh.RawToken, newRefresh.ExpiresAt);
        return Ok(new AuthResponse(accessToken, accessExpires, await ToSummaryAsync(user, roles, cancellationToken)));
    }

    [HttpPost("logout")]
    public async Task<ActionResult> Logout(CancellationToken cancellationToken)
    {
        if (Request.Cookies.TryGetValue(RefreshCookieName, out var rawToken) &&
            !string.IsNullOrWhiteSpace(rawToken))
        {
            var validation = await _tokens.ValidateRefreshTokenAsync(rawToken, cancellationToken);
            if (validation is not null)
            {
                await _tokens.RevokeAsync(validation.TokenId, GetClientIp(), null, cancellationToken);
            }
        }

        ClearRefreshCookie();
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserSummary>> Me(CancellationToken cancellationToken)
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value;
        if (userId is null)
        {
            return Unauthorized();
        }

        var user = await _users.FindByIdAsync(userId);
        if (user is null || user.DeletedAt is not null)
        {
            return Unauthorized();
        }

        var roles = await _users.GetRolesAsync(user);
        return Ok(await ToSummaryAsync(user, roles, cancellationToken));
    }

    private async Task<AuthResponse> IssueTokensAsync(
        ApplicationUser user,
        CancellationToken cancellationToken)
    {
        var roles = await _users.GetRolesAsync(user);
        var accessToken = _tokens.IssueAccessToken(user.Id, user.Email!, roles.ToList());
        var accessExpires = DateTime.UtcNow.AddMinutes(_jwt.AccessTokenLifetimeMinutes);

        var refresh = await _tokens.IssueRefreshTokenAsync(user.Id, GetClientIp(), cancellationToken);
        SetRefreshCookie(refresh.RawToken, refresh.ExpiresAt);

        return new AuthResponse(accessToken, accessExpires, await ToSummaryAsync(user, roles, cancellationToken));
    }

    private void SetRefreshCookie(string rawToken, DateTime expiresAt)
    {
        Response.Cookies.Append(RefreshCookieName, rawToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = !_env.IsDevelopment(),
            SameSite = SameSiteMode.Lax,
            Expires = expiresAt,
            Path = "/api/auth"
        });
    }

    private void ClearRefreshCookie()
    {
        Response.Cookies.Delete(RefreshCookieName, new CookieOptions
        {
            HttpOnly = true,
            Secure = !_env.IsDevelopment(),
            SameSite = SameSiteMode.Lax,
            Path = "/api/auth"
        });
    }

    private string? GetClientIp() =>
        HttpContext.Connection.RemoteIpAddress?.ToString();

    private async Task<UserSummary> ToSummaryAsync(
        ApplicationUser user,
        IList<string> roles,
        CancellationToken cancellationToken)
    {
        var memberships = await _memberships.GetMembershipsAsync(user.Id, cancellationToken);
        var membershipDtos = memberships
            .Select(m => new SupplierMembershipDto(
                m.SupplierId, m.SupplierSlug, m.SupplierName, m.Role))
            .ToList();
        return new UserSummary(
            user.Id, user.Email ?? string.Empty, user.DisplayName, user.Locale,
            roles.ToList(), membershipDtos);
    }

    private static string NormalizeLocale(string? locale) =>
        string.IsNullOrWhiteSpace(locale) ? "sq" : locale.Trim().ToLowerInvariant();
}
