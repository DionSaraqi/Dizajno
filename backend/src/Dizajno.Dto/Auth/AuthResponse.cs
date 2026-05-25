namespace Dizajno.Dto.Auth;

public sealed record AuthResponse(
    string AccessToken,
    DateTime AccessTokenExpiresAt,
    UserSummary User);
