namespace Dizajno.Application.Interfaces;

public interface IJwtTokenService
{
    /// <summary>Issues a short-lived signed JWT access token.</summary>
    string IssueAccessToken(Guid userId, string email, IReadOnlyList<string> roles);

    /// <summary>Generates and persists a new refresh token; returns the raw value once.</summary>
    Task<RefreshTokenIssued> IssueRefreshTokenAsync(
        Guid userId,
        string? createdByIp,
        CancellationToken cancellationToken);

    /// <summary>
    /// Looks up an active refresh token by its raw value. Returns null if the token is
    /// unknown, expired, or revoked.
    /// </summary>
    Task<RefreshTokenValidation?> ValidateRefreshTokenAsync(
        string rawToken,
        CancellationToken cancellationToken);

    /// <summary>Revokes a token and records which new token replaced it (if any).</summary>
    Task RevokeAsync(
        Guid tokenId,
        string? revokedByIp,
        Guid? replacedByTokenId,
        CancellationToken cancellationToken);
}

public sealed record RefreshTokenIssued(string RawToken, Guid TokenId, DateTime ExpiresAt);

public sealed record RefreshTokenValidation(Guid TokenId, Guid UserId, DateTime ExpiresAt);
