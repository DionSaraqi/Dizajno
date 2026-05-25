namespace Dizajno.Dto.Share;

public sealed record CommentDto(
    Guid Id,
    Guid? ParentCommentId,
    Guid? AuthorUserId,
    string? AuthorDisplayName,
    string? GuestName,
    string Body,
    System.Text.Json.JsonElement? Anchor,
    DateTime CreatedAt,
    DateTime? ResolvedAt);
