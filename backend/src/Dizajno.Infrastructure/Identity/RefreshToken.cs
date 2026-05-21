namespace Dizajno.Infrastructure.Identity;

/// <summary>
/// Server-side record of an issued refresh token. The raw token value is never persisted —
/// only a SHA-256 hash. Rotation: each refresh issues a new token and links the old one
/// via <see cref="ReplacedByTokenId"/> so the chain is auditable.
/// </summary>
public sealed class RefreshToken
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }

    /// <summary>Base64 SHA-256 hash of the raw token. The raw token leaves the server once.</summary>
    public string TokenHash { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? CreatedByIp { get; set; }

    public DateTime? RevokedAt { get; set; }
    public string? RevokedByIp { get; set; }
    public Guid? ReplacedByTokenId { get; set; }

    public bool IsActive => RevokedAt is null && DateTime.UtcNow < ExpiresAt;
}
