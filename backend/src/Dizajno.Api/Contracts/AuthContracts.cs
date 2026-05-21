using System.ComponentModel.DataAnnotations;

namespace Dizajno.Api.Contracts;

public sealed record RegisterRequest(
    [Required, EmailAddress] string Email,
    [Required, MinLength(8)] string Password,
    string? DisplayName,
    string? Locale);

public sealed record LoginRequest(
    [Required, EmailAddress] string Email,
    [Required] string Password);

public sealed record AuthResponse(
    string AccessToken,
    DateTime AccessTokenExpiresAt,
    UserSummary User);

public sealed record UserSummary(
    Guid Id,
    string Email,
    string? DisplayName,
    string Locale,
    IReadOnlyList<string> Roles);
