using Dizajno.Domain.Enums;

namespace Dizajno.Domain.Entities;

public sealed class ProjectShare
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public ShareMode Mode { get; set; }
    /// <summary>
    /// Random opaque token used for the public link form of a share. Exactly one
    /// of <see cref="Token"/>, <see cref="InvitedEmail"/>, <see cref="InvitedUserId"/>
    /// is populated — a DB check constraint enforces it.
    /// </summary>
    public string? Token { get; set; }
    public string? InvitedEmail { get; set; }
    public Guid? InvitedUserId { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public Guid CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? RevokedAt { get; set; }

    public Project Project { get; set; } = null!;
}
