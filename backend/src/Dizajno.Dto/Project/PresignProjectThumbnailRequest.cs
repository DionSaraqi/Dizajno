namespace Dizajno.Dto.Project;

public sealed record PresignProjectThumbnailRequest(
    string ContentType,
    long SizeBytes);
