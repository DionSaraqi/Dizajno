namespace Dizajno.Application.Options;

/// <summary>
/// Cloudflare R2 connection settings. Bound from configuration section "R2".
/// In Development, may be empty â€” the S3 client lazily validates on first use.
/// </summary>
public sealed class R2Options
{
    public const string SectionName = "R2";

    /// <summary>Cloudflare account id used to build the S3-compatible endpoint URL.</summary>
    public string AccountId { get; init; } = string.Empty;

    /// <summary>
    /// Optional S3 endpoint override for local development (e.g. MinIO at
    /// "http://localhost:9000"). When set, <see cref="AccountId"/> is not
    /// required and presigned URLs use this endpoint's scheme. Leave empty in
    /// production so the endpoint derives from <see cref="AccountId"/>.
    /// </summary>
    public string ServiceUrl { get; init; } = string.Empty;

    /// <summary>Access key id of an R2 API token scoped to <see cref="Bucket"/>.</summary>
    public string AccessKeyId { get; init; } = string.Empty;

    /// <summary>Secret access key paired with <see cref="AccessKeyId"/>.</summary>
    public string SecretAccessKey { get; init; } = string.Empty;

    /// <summary>R2 bucket name (e.g. "dizajno-assets").</summary>
    public string Bucket { get; init; } = string.Empty;

    /// <summary>
    /// Public base URL used to build asset URLs after upload. Either the R2.dev
    /// bucket URL ("https://pub-XYZ.r2.dev") or a custom domain ("https://assets.dizajno.com").
    /// No trailing slash.
    /// </summary>
    public string PublicBaseUrl { get; init; } = string.Empty;

    /// <summary>Lifetime of presigned PUT URLs. Defaults to 10 minutes.</summary>
    public int PresignedUrlLifetimeMinutes { get; init; } = 10;
}
