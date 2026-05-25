using System.ComponentModel.DataAnnotations;
using Dizajno.Domain.Enums;

namespace Dizajno.Dto.Supplier;

public sealed record CreateProductRequest(
    [Required] Guid SupplierId,
    [Required] ProductFamily Family,
    [Required] Guid CategoryId,
    [Required, MaxLength(160)] string Slug,
    [Required, MaxLength(200)] string Name,
    string? Description,
    UnitOfSale UnitOfSale,
    decimal? CoverageRate,
    decimal WasteFactor,
    int? LeadTimeDays,
    string? PreviewSvg,
    string? TextureUrl,
    /// <summary>jsonb-shaped attributes (icon, lumen, energyClass, ...). Free-form per family.</summary>
    string? Attributes);
