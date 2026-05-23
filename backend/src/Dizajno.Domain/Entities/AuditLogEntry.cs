namespace Dizajno.Domain.Entities;

/// <summary>
/// One row per sensitive action: supplier lifecycle (create/suspend/restore/
/// trust/untrust/profile-edit), product status transitions, role/membership
/// changes (invite/accept/role-change/remove). Used by the admin dashboard's
/// audit-log search for incident response and dispute resolution.
/// </summary>
public sealed class AuditLogEntry
{
    public Guid Id { get; set; }
    /// <summary>The user who performed the action. Null for system-triggered events.</summary>
    public Guid? ActorUserId { get; set; }
    /// <summary>Stable kebab-case action identifier, e.g. <c>supplier.suspend</c>, <c>product.publish</c>, <c>member.invite</c>.</summary>
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public Guid EntityId { get; set; }
    /// <summary>Optional before/after diff or context payload. Stored as jsonb.</summary>
    public string? Diff { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public DateTime CreatedAt { get; set; }
}
