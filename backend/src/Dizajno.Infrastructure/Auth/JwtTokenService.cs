using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Dizajno.Application.Interfaces;
using Dizajno.Application.Options;
using Dizajno.Data.Identity;
using Dizajno.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Dizajno.Infrastructure.Auth;

public sealed class JwtTokenService : IJwtTokenService
{
    private readonly DizajnoDbContext _db;
    private readonly JwtOptions _options;
    private readonly SigningCredentials _signingCredentials;

    public JwtTokenService(DizajnoDbContext db, IOptions<JwtOptions> options)
    {
        _db = db;
        _options = options.Value;

        var keyBytes = Encoding.UTF8.GetBytes(_options.SigningKey);
        if (keyBytes.Length < 32)
        {
            throw new InvalidOperationException(
                "JwtSettings:SigningKey must be at least 32 bytes (256 bits) for HMAC-SHA256.");
        }

        var key = new SymmetricSecurityKey(keyBytes);
        _signingCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
    }

    public string IssueAccessToken(Guid userId, string email, IReadOnlyList<string> roles)
    {
        var now = DateTime.UtcNow;
        var expires = now.AddMinutes(_options.AccessTokenLifetimeMinutes);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new(JwtRegisteredClaimNames.Email, email),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        foreach (var role in roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            notBefore: now,
            expires: expires,
            signingCredentials: _signingCredentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public async Task<RefreshTokenIssued> IssueRefreshTokenAsync(
        Guid userId,
        string? createdByIp,
        CancellationToken cancellationToken)
    {
        var rawToken = GenerateRawToken();
        var hash = HashToken(rawToken);
        var expiresAt = DateTime.UtcNow.AddDays(_options.RefreshTokenLifetimeDays);

        var record = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TokenHash = hash,
            ExpiresAt = expiresAt,
            CreatedByIp = createdByIp
        };

        _db.RefreshTokens.Add(record);
        await _db.SaveChangesAsync(cancellationToken);

        return new RefreshTokenIssued(rawToken, record.Id, expiresAt);
    }

    public async Task<RefreshTokenValidation?> ValidateRefreshTokenAsync(
        string rawToken,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(rawToken))
        {
            return null;
        }

        var hash = HashToken(rawToken);
        var record = await _db.RefreshTokens
            .FirstOrDefaultAsync(r => r.TokenHash == hash, cancellationToken);

        if (record is null || !record.IsActive)
        {
            return null;
        }

        return new RefreshTokenValidation(record.Id, record.UserId, record.ExpiresAt);
    }

    public async Task RevokeAsync(
        Guid tokenId,
        string? revokedByIp,
        Guid? replacedByTokenId,
        CancellationToken cancellationToken)
    {
        var record = await _db.RefreshTokens
            .FirstOrDefaultAsync(r => r.Id == tokenId, cancellationToken);

        if (record is null || record.RevokedAt is not null)
        {
            return;
        }

        record.RevokedAt = DateTime.UtcNow;
        record.RevokedByIp = revokedByIp;
        record.ReplacedByTokenId = replacedByTokenId;
        await _db.SaveChangesAsync(cancellationToken);
    }

    private static string GenerateRawToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes)
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');
    }

    private static string HashToken(string rawToken)
    {
        var bytes = Encoding.UTF8.GetBytes(rawToken);
        var hash = SHA256.HashData(bytes);
        return Convert.ToBase64String(hash);
    }
}
