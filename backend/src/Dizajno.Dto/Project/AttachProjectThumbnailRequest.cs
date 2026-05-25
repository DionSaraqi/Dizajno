namespace Dizajno.Dto.Project;

public sealed record AttachProjectThumbnailRequest(
    string Key,
    string MimeType,
    long SizeBytes);
