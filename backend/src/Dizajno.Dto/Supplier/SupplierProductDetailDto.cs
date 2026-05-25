using Dizajno.Domain.Enums;

namespace Dizajno.Dto.Supplier;

public sealed record SupplierProductDetailDto(
    Guid Id,
    Guid SupplierId,
    string Slug,
    string Name,
    string Family,
    Guid CategoryId,
    string CategoryName,
    ProductStatus Status,
    string UnitOfSale,
    decimal? CoverageRate,
    decimal WasteFactor,
    int? LeadTimeDays,
    string? Description,
    string? PreviewSvg,
    string? TextureUrl,
    string Attributes,
    IReadOnlyList<SupplierVariantDto> Variants,
    DateTime CreatedAt,
    DateTime UpdatedAt);
