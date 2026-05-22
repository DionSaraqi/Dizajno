namespace Dizajno.Application.Storage;

/// <summary>
/// Abstraction over the configured object store (Cloudflare R2 in production,
/// mocked in tests). Concrete implementation lives in Dizajno.Infrastructure.
/// </summary>
public interface IObjectStorage
{
    /// <summary>
    /// Returns a presigned PUT URL the caller can use to upload <paramref name="contentLength"/>
    /// bytes of <paramref name="contentType"/> data directly to the bucket under <paramref name="key"/>.
    /// </summary>
    Task<PresignedUploadUrl> CreatePresignedUploadUrlAsync(
        string key,
        string contentType,
        long contentLength,
        CancellationToken cancellationToken);

    /// <summary>Builds the public URL for a key already stored in the bucket.</summary>
    string GetPublicUrl(string key);
}

/// <summary>Result of a presigned upload URL request.</summary>
/// <param name="Url">URL the client should PUT to.</param>
/// <param name="ExpiresAt">UTC moment after which the URL stops working.</param>
/// <param name="RequiredHeaders">
/// Headers the client must include verbatim on the PUT or the signature will fail
/// (e.g. <c>Content-Type</c>, <c>Content-Length</c>).
/// </param>
public sealed record PresignedUploadUrl(
    string Url,
    DateTime ExpiresAt,
    IReadOnlyDictionary<string, string> RequiredHeaders);
