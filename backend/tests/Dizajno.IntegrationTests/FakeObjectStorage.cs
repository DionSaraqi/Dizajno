using Dizajno.Application.Interfaces;
using Dizajno.Application.Options;

namespace Dizajno.IntegrationTests;

/// <summary>
/// Deterministic <see cref="IObjectStorage"/> used in integration tests.
/// Records every presign request and returns predictable URLs so assertions can
/// match exact values.
/// </summary>
public sealed class FakeObjectStorage : IObjectStorage
{
    private readonly string _publicBaseUrl;
    public List<PresignCall> Calls { get; } = new();

    public FakeObjectStorage(string publicBaseUrl)
    {
        _publicBaseUrl = publicBaseUrl.TrimEnd('/');
    }

    public Task<PresignedUploadUrl> CreatePresignedUploadUrlAsync(
        string key,
        string contentType,
        long contentLength,
        CancellationToken cancellationToken)
    {
        Calls.Add(new PresignCall(key, contentType, contentLength));
        var expiresAt = DateTime.UtcNow.AddMinutes(10);
        var url = $"https://fake-r2.test.local/{key}?presigned=1";
        var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Content-Type"] = contentType,
            ["Content-Length"] = contentLength.ToString(System.Globalization.CultureInfo.InvariantCulture)
        };
        return Task.FromResult(new PresignedUploadUrl(url, expiresAt, headers));
    }

    public string GetPublicUrl(string key) => $"{_publicBaseUrl}/{key.TrimStart('/')}";

    public sealed record PresignCall(string Key, string ContentType, long ContentLength);
}
