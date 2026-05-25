namespace Dizajno.Dto.Admin;

public sealed record AuditLogEntryDto(
    Guid Id,
    Guid? ActorUserId,
    string? ActorEmail,
    string Action,
    string EntityType,
    Guid EntityId,
    string? Diff,
    string? IpAddress,
    DateTime CreatedAt);
