using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using Dizajno.Application.Interfaces;
using Dizajno.Application.Options;
using Microsoft.Extensions.Options;

namespace Dizajno.Infrastructure.Storage;

/// <summary>
/// <see cref="IObjectStorage"/> backed by the AWS S3 SDK pointed at Cloudflare R2.
///
/// R2 quirks worth knowing:
/// <list type="bullet">
///   <item>Endpoint is <c>https://{accountId}.r2.cloudflarestorage.com</c>.</item>
///   <item>R2 requires path-style addressing (<c>ForcePathStyle = true</c>).</item>
///   <item>Region is irrelevant on R2 but the SDK requires a non-empty value; "auto" is conventional.</item>
/// </list>
/// </summary>
public sealed class S3ObjectStorage : IObjectStorage, IDisposable
{
    private readonly IOptionsMonitor<R2Options> _options;
    private readonly Lazy<IAmazonS3> _client;

    public S3ObjectStorage(IOptionsMonitor<R2Options> options)
    {
        _options = options;
        _client = new Lazy<IAmazonS3>(BuildClient);
    }

    public Task<PresignedUploadUrl> CreatePresignedUploadUrlAsync(
        string key,
        string contentType,
        long contentLength,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(key))
        {
            throw new ArgumentException("Key must not be empty.", nameof(key));
        }
        if (string.IsNullOrWhiteSpace(contentType))
        {
            throw new ArgumentException("Content type must not be empty.", nameof(contentType));
        }
        if (contentLength <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(contentLength), "Content length must be positive.");
        }

        var opts = GetValidatedOptions();
        var expiresAt = DateTime.UtcNow.AddMinutes(opts.PresignedUrlLifetimeMinutes);

        var request = new GetPreSignedUrlRequest
        {
            BucketName = opts.Bucket,
            Key = key,
            Verb = HttpVerb.PUT,
            Expires = expiresAt,
            ContentType = contentType,
            Protocol = Protocol.HTTPS
        };

        var url = _client.Value.GetPreSignedURL(request);

        var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Content-Type"] = contentType,
            ["Content-Length"] = contentLength.ToString(System.Globalization.CultureInfo.InvariantCulture)
        };

        return Task.FromResult(new PresignedUploadUrl(url, expiresAt, headers));
    }

    public string GetPublicUrl(string key)
    {
        if (string.IsNullOrWhiteSpace(key))
        {
            throw new ArgumentException("Key must not be empty.", nameof(key));
        }

        var opts = GetValidatedOptions();
        return $"{opts.PublicBaseUrl.TrimEnd('/')}/{key.TrimStart('/')}";
    }

    public void Dispose()
    {
        if (_client.IsValueCreated)
        {
            _client.Value.Dispose();
        }
    }

    private R2Options GetValidatedOptions()
    {
        var o = _options.CurrentValue;
        if (string.IsNullOrWhiteSpace(o.AccountId) ||
            string.IsNullOrWhiteSpace(o.AccessKeyId) ||
            string.IsNullOrWhiteSpace(o.SecretAccessKey) ||
            string.IsNullOrWhiteSpace(o.Bucket) ||
            string.IsNullOrWhiteSpace(o.PublicBaseUrl))
        {
            throw new InvalidOperationException(
                "Cloudflare R2 is not configured. Set R2:AccountId, R2:AccessKeyId, " +
                "R2:SecretAccessKey, R2:Bucket, and R2:PublicBaseUrl in configuration " +
                "or via DIZAJNO_R2__* environment variables.");
        }
        return o;
    }

    private IAmazonS3 BuildClient()
    {
        var o = GetValidatedOptions();
        var credentials = new BasicAWSCredentials(o.AccessKeyId, o.SecretAccessKey);
        var config = new AmazonS3Config
        {
            ServiceURL = $"https://{o.AccountId}.r2.cloudflarestorage.com",
            ForcePathStyle = true,
            // R2 ignores region, but the SDK requires a non-empty value.
            AuthenticationRegion = "auto"
        };
        return new AmazonS3Client(credentials, config);
    }
}
