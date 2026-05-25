using System.ComponentModel.DataAnnotations;

namespace Dizajno.Dto.Supplier;

/// <summary>One row in a variant's texture-slot binding table.</summary>
public sealed record VariantTextureSlotInput(
    [Required, MaxLength(120)] string SlotName,
    [Required] Guid SupplierTextureId,
    bool IsDefault);
