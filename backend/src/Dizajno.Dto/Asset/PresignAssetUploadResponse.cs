namespace Dizajno.Dto.Asset;

public sealed record PresignAssetUploadResponse(
    string Key,
    string UploadUrl,
    DateTime ExpiresAt,
    string PublicUrl,
    Dictionary<string, string> RequiredHeaders);
