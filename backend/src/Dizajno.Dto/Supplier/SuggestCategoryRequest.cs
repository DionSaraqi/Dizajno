using System.ComponentModel.DataAnnotations;
using Dizajno.Domain.Enums;

namespace Dizajno.Dto.Supplier;

public sealed record SuggestCategoryRequest(
    [Required] Guid SupplierId,
    [Required] ProductFamily Family,
    Guid? ParentCategoryId,
    [Required, MaxLength(200)] string Name);
