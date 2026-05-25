namespace Dizajno.Dto.Project;

public sealed record FloorDto(
    Guid Id,
    IReadOnlyList<IReadOnlyList<decimal>> Vertices,
    Guid? FlooringProductVariantId = null);
