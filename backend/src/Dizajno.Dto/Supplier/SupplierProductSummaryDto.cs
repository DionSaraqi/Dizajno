using Dizajno.Domain.Enums;

namespace Dizajno.Dto.Supplier;

/// <summary>
/// Row in a supplier's own product list. Includes Draft/Pending/Hidden/Removed
/// in addition to Published — suppliers see their entire catalog regardless
/// of public visibility.
/// </summary>
public sealed record SupplierProductSummaryDto(
    Guid Id,
    string Slug,
    string Name,
    string Family,
    Guid CategoryId,
    string CategoryName,
    ProductStatus Status,
    string UnitOfSale,
    decimal? BasePrice,
    string Currency,
    int VariantCount,
    DateTime CreatedAt,
    DateTime UpdatedAt);
