namespace Dizajno.Dto.Admin;

public sealed record AuditLogPageDto(
    IReadOnlyList<AuditLogEntryDto> Entries,
    int TotalCount,
    int Page,
    int PageSize);
