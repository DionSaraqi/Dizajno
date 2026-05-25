using System.ComponentModel.DataAnnotations;

namespace Dizajno.Dto.Supplier;

/// <summary>
/// Full replacement of a variant's texture slot bindings. The handler deletes
/// existing rows and inserts the supplied ones in one transaction, which is
/// simpler than computing a diff and matches the supplier UX (edit-and-save
/// the whole table). Every <see cref="VariantTextureSlotInput.SupplierTextureId"/>
/// must belong to the variant's product's supplier — DB trigger enforces this
/// too, but the controller fails fast with a 400.
/// </summary>
public sealed record ReplaceVariantTextureSlotsRequest(
    [Required] IReadOnlyList<VariantTextureSlotInput> Slots);
