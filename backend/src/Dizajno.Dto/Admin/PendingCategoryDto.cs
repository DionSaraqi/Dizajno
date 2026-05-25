namespace Dizajno.Dto.Admin;

public sealed record PendingCategoryDto(
    Guid Id,
    string Slug,
    string Name,
    string Family,
    string Path,
    Guid? SuggestedBySupplierId,
    string? SuggestedBySupplierName);
