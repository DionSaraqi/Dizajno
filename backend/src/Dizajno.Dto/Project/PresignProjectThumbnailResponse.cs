namespace Dizajno.Dto.Project;

public sealed record PresignProjectThumbnailResponse(
    string Key,
    string UploadUrl,
    DateTime ExpiresAt,
    string PublicUrl,
    Dictionary<string, string> RequiredHeaders);
