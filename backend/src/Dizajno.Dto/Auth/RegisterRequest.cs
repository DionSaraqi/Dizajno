using System.ComponentModel.DataAnnotations;

namespace Dizajno.Dto.Auth;

public sealed record RegisterRequest(
    [Required, EmailAddress] string Email,
    [Required, MinLength(8)] string Password,
    string? DisplayName,
    string? Locale);
