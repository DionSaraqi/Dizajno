using Dizajno.Domain.Enums;

namespace Dizajno.Dto.Supplier;

public sealed record SupplierMemberSummaryDto(
    Guid Id,
    Guid SupplierId,
    Guid UserId,
    string UserEmail,
    string? UserDisplayName,
    SupplierMemberRole Role,
    DateTime CreatedAt);
