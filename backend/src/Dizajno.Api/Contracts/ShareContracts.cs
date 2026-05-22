using Dizajno.Domain.Enums;

namespace Dizajno.Api.Contracts;

// ── Owner-side: manage shares on /api/projects/{id}/shares ─────────────────

public sealed record CreateShareRequest(
    ShareMode Mode,
    ShareKind Kind,
    string? InvitedEmail,
    DateTime? ExpiresAt);

public enum ShareKind
{
    Link = 0,
    Email = 1
}

public sealed record ShareSummaryDto(
    Guid Id,
    ShareMode Mode,
    string? Token,
    string? InvitedEmail,
    DateTime? ExpiresAt,
    DateTime CreatedAt,
    DateTime? RevokedAt);

// ── Public-side: load a share by token at /api/share/{token} ───────────────

public sealed record SharedProjectDto(
    Guid ProjectId,
    string Name,
    string? ThumbnailUrl,
    ShareMode Mode,
    SceneDto Scene);

// ── Comments ───────────────────────────────────────────────────────────────

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
