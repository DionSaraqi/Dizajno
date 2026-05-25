namespace Dizajno.Dto.Project;

public sealed record PlacedItemDto(
    Guid Id,
    Guid ProductVariantId,
    decimal PositionX,
    decimal PositionZ,
    decimal Rotation,
    decimal Scale,
    decimal ScaledWidth,
    decimal ScaledDepth,
    decimal ScaledHeight,
    Dictionary<string, string>? MaterialColors,
    Dictionary<string, string>? MaterialTextures);
