using System.ComponentModel.DataAnnotations;

namespace Dizajno.Dto.Auth;

public sealed record LoginRequest(
    [Required, EmailAddress] string Email,
    [Required] string Password);
