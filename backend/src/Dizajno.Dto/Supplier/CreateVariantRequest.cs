using System.ComponentModel.DataAnnotations;

namespace Dizajno.Dto.Supplier;

public sealed record CreateVariantRequest(
    [Required, MaxLength(120)] string Sku,
    [Required, MaxLength(200)] string Name,
    [Range(0.01, 50)] decimal Width,
    [Range(0.01, 50)] decimal Depth,
    [Range(0.01, 50)] decimal Height,
    [MaxLength(16)] string Color,
    decimal? BasePrice,
    [MaxLength(3)] string Currency,
    string? CollisionBoxes,
    string? MaterialDefaults,
    string? Attributes,
    int? SortOrder);
