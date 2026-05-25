using System.Security.Cryptography;

namespace Dizajno.Application.Services;

public static class InviteTokenFactory
{
    public static (string RawToken, string Hash) Generate()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        var raw = Convert.ToBase64String(bytes)
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');
        return (raw, HashToken(raw));
    }

    public static string HashToken(string rawToken)
    {
        var hash = SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(rawToken));
        return Convert.ToBase64String(hash);
    }
}
