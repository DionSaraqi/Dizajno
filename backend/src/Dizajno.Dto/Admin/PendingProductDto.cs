namespace Dizajno.Dto.Admin;

public sealed record PendingProductDto(
    Guid Id,
    string Slug,
    string Name,
    string Family,
    string Category,
    Guid SupplierId,
    string SupplierName,
    DateTime CreatedAt);
