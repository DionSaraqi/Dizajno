using Dizajno.Domain.Enums;

namespace Dizajno.Dto.Supplier;

public sealed record SuggestedCategoryDto(
    Guid Id,
    ProductFamily Family,
    Guid? ParentCategoryId,
    string Slug,
    string Name,
    string Path,
    CategoryStatus Status,
    Guid? SuggestedBySupplierId);
