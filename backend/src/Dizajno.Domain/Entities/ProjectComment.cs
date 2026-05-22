namespace Dizajno.Domain.Entities;

public sealed class ProjectComment
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public Guid? ParentCommentId { get; set; }
    /// <summary>FK to AspNetUsers when the comment was made by a signed-in user.</summary>
    public Guid? AuthorUserId { get; set; }
    /// <summary>Display name supplied by an anonymous link visitor.</summary>
    public string? GuestName { get; set; }
    public string? GuestEmail { get; set; }
    /// <summary>FK to the share row the visitor came through; null for owner-posted comments.</summary>
    public Guid? ShareId { get; set; }
    public string Body { get; set; } = string.Empty;
    /// <summary>
    /// Optional spatial anchor for Figma-style pins. Stored as jsonb:
    /// <c>{ "type": "item" | "wall" | "point", "id"?: string, "x"?: number, "z"?: number }</c>
    /// </summary>
    public string? Anchor { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public DateTime? DeletedAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public Project Project { get; set; } = null!;
    public ProjectShare? Share { get; set; }
    public ProjectComment? ParentComment { get; set; }
}
