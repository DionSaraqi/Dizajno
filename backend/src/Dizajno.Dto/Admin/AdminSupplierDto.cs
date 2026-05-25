namespace Dizajno.Dto.Admin;

public sealed record AdminSupplierDto(
    Guid Id,
    string Slug,
    string Name,
    string? Description,
    string? WebsiteUrl,
    string? ContactEmail,
    string? ContactPhone,
    bool IsTrusted,
    DateTime? SuspendedAt,
    int MemberCount,
    int ProductCount,
    DateTime CreatedAt);
