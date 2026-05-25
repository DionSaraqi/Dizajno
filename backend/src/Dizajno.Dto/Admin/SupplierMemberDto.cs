using Dizajno.Domain.Enums;

namespace Dizajno.Dto.Admin;

public sealed record SupplierMemberDto(
    Guid Id,
    Guid SupplierId,
    string SupplierSlug,
    string SupplierName,
    Guid UserId,
    string UserEmail,
    string? UserDisplayName,
    SupplierMemberRole Role,
    DateTime CreatedAt);
