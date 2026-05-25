using System.ComponentModel.DataAnnotations;
using Dizajno.Domain.Enums;

namespace Dizajno.Dto.Supplier;

public sealed record UpdateProductRequest(
    [Required] Guid CategoryId,
    [Required, MaxLength(200)] string Name,
    string? Description,
    UnitOfSale UnitOfSale,
    decimal? CoverageRate,
    decimal WasteFactor,
    int? LeadTimeDays,
    string? PreviewSvg,
    string? TextureUrl,
    string? Attributes);
