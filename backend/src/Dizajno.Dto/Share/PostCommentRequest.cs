namespace Dizajno.Dto.Share;

/// <summary>
/// Anchor is an opaque JsonElement — the server stores it verbatim as jsonb
/// and returns it unchanged. Frontend shape: <c>{ type: "item"|"wall"|"point", id?, x?, z? }</c>.
/// </summary>
public sealed record PostCommentRequest(
    string Body,
    string? GuestName,
    string? GuestEmail,
    Guid? ParentCommentId,
    System.Text.Json.JsonElement? Anchor);
