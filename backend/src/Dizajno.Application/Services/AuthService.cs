using System.Security.Claims;
using Dizajno.Application.Interfaces;
using Dizajno.Application.Options;
using Dizajno.Data.Identity;
using Dizajno.Dto.Auth;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Dizajno.Application.Services;

public sealed class AuthService : IAuthService
{
    private const string RefreshCookieName = "dizajno_rt";

    private readonly UserManager<ApplicationUser> _users;
    private readonly IJwtTokenService _tokens;
    private readonly ISupplierMembershipResolver _memberships;
    private readonly JwtOptions _jwt;
    private readonly IWebHostEnvironment _env;

    public AuthService(
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

    public async Task<ActionResult<AuthResponse>> RegisterAsync(
        RegisterRequest request,
        HttpContext httpContext,
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
            return new BadRequestObjectResult(new { errors = result.Errors.Select(e => e.Description) });
        }

        var response = await IssueTokensAsync(user, httpContext, cancellationToken);
        return new ObjectResult(response) { StatusCode = StatusCodes.Status201Created };
    }

    public async Task<ActionResult<AuthResponse>> LoginAsync(
        LoginRequest request,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var user = await _users.FindByEmailAsync(request.Email);
        if (user is null || user.DeletedAt is not null)
        {
            return new UnauthorizedObjectResult(new { error = "Invalid credentials." });
        }

        var passwordOk = await _users.CheckPasswordAsync(user, request.Password);
        if (!passwordOk)
        {
            return new UnauthorizedObjectResult(new { error = "Invalid credentials." });
        }

        var response = await IssueTokensAsync(user, httpContext, cancellationToken);
        return new OkObjectResult(response);
    }

    public async Task<ActionResult<AuthResponse>> RefreshAsync(
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        if (!httpContext.Request.Cookies.TryGetValue(RefreshCookieName, out var rawToken) ||
            string.IsNullOrWhiteSpace(rawToken))
        {
            return new UnauthorizedObjectResult(new { error = "No refresh token." });
        }

        var validation = await _tokens.ValidateRefreshTokenAsync(rawToken, cancellationToken);
        if (validation is null)
        {
            ClearRefreshCookie(httpContext);
            return new UnauthorizedObjectResult(new { error = "Invalid or expired refresh token." });
        }

        var user = await _users.FindByIdAsync(validation.UserId.ToString());
        if (user is null || user.DeletedAt is not null)
        {
            await _tokens.RevokeAsync(validation.TokenId, GetClientIp(httpContext), null, cancellationToken);
            ClearRefreshCookie(httpContext);
            return new UnauthorizedObjectResult(new { error = "User is no longer active." });
        }

        // Rotate: issue a new refresh token, revoke the old one with a link.
        var newRefresh = await _tokens.IssueRefreshTokenAsync(user.Id, GetClientIp(httpContext), cancellationToken);
        await _tokens.RevokeAsync(validation.TokenId, GetClientIp(httpContext), newRefresh.TokenId, cancellationToken);

        var roles = await _users.GetRolesAsync(user);
        var accessToken = _tokens.IssueAccessToken(user.Id, user.Email!, roles.ToList());
        var accessExpires = DateTime.UtcNow.AddMinutes(_jwt.AccessTokenLifetimeMinutes);

        SetRefreshCookie(httpContext, newRefresh.RawToken, newRefresh.ExpiresAt);
        return new OkObjectResult(new AuthResponse(accessToken, accessExpires, await ToSummaryAsync(user, roles, cancellationToken)));
    }

    public async Task<ActionResult> LogoutAsync(
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        if (httpContext.Request.Cookies.TryGetValue(RefreshCookieName, out var rawToken) &&
            !string.IsNullOrWhiteSpace(rawToken))
        {
            var validation = await _tokens.ValidateRefreshTokenAsync(rawToken, cancellationToken);
            if (validation is not null)
            {
                await _tokens.RevokeAsync(validation.TokenId, GetClientIp(httpContext), null, cancellationToken);
            }
        }

        ClearRefreshCookie(httpContext);
        return new NoContentResult();
    }

    public async Task<ActionResult<UserSummary>> MeAsync(
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        var userId = user.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            ?? user.FindFirst("sub")?.Value;
        if (userId is null)
        {
            return new UnauthorizedResult();
        }

        var appUser = await _users.FindByIdAsync(userId);
        if (appUser is null || appUser.DeletedAt is not null)
        {
            return new UnauthorizedResult();
        }

        var roles = await _users.GetRolesAsync(appUser);
        return new OkObjectResult(await ToSummaryAsync(appUser, roles, cancellationToken));
    }

    private async Task<AuthResponse> IssueTokensAsync(
        ApplicationUser user,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var roles = await _users.GetRolesAsync(user);
        var accessToken = _tokens.IssueAccessToken(user.Id, user.Email!, roles.ToList());
        var accessExpires = DateTime.UtcNow.AddMinutes(_jwt.AccessTokenLifetimeMinutes);

        var refresh = await _tokens.IssueRefreshTokenAsync(user.Id, GetClientIp(httpContext), cancellationToken);
        SetRefreshCookie(httpContext, refresh.RawToken, refresh.ExpiresAt);

        return new AuthResponse(accessToken, accessExpires, await ToSummaryAsync(user, roles, cancellationToken));
    }

    private void SetRefreshCookie(HttpContext httpContext, string rawToken, DateTime expiresAt)
    {
        httpContext.Response.Cookies.Append(RefreshCookieName, rawToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = !_env.IsDevelopment(),
            SameSite = SameSiteMode.Lax,
            Expires = expiresAt,
            Path = "/api/auth"
        });
    }

    private void ClearRefreshCookie(HttpContext httpContext)
    {
        httpContext.Response.Cookies.Delete(RefreshCookieName, new CookieOptions
        {
            HttpOnly = true,
            Secure = !_env.IsDevelopment(),
            SameSite = SameSiteMode.Lax,
            Path = "/api/auth"
        });
    }

    private static string? GetClientIp(HttpContext httpContext) =>
        httpContext.Connection.RemoteIpAddress?.ToString();

    private async Task<UserSummary> ToSummaryAsync(
        ApplicationUser user,
        IList<string> roles,
        CancellationToken cancellationToken)
    {
        var memberships = await _memberships.GetMembershipsAsync(user.Id, cancellationToken);
        var membershipDtos = memberships
            .Select(m => new SupplierMembershipDto(
                m.SupplierId, m.SupplierSlug, m.SupplierName, m.Role, m.IsSuspended))
            .ToList();
        return new UserSummary(
            user.Id, user.Email ?? string.Empty, user.DisplayName, user.Locale,
            roles.ToList(), membershipDtos);
    }

    private static string NormalizeLocale(string? locale) =>
        string.IsNullOrWhiteSpace(locale) ? "sq" : locale.Trim().ToLowerInvariant();
}
