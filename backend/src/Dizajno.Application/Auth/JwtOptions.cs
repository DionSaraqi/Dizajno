namespace Dizajno.Application.Auth;

public sealed class JwtOptions
{
    public const string SectionName = "JwtSettings";

    public required string Issuer { get; init; }
    public required string Audience { get; init; }
    /// <summary>HMAC-SHA256 signing key (32+ bytes recommended). Loaded from User Secrets in dev.</summary>
    public required string SigningKey { get; init; }
    public int AccessTokenLifetimeMinutes { get; init; } = 15;
    public int RefreshTokenLifetimeDays { get; init; } = 30;
}
