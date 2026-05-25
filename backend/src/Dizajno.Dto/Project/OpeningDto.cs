using Dizajno.Domain.Enums;

namespace Dizajno.Dto.Project;

public sealed record OpeningDto(
    Guid Id,
    Guid WallId,
    OpeningType Type,
    decimal OffsetFromStart,
    decimal Width,
    decimal Height,
    decimal SillHeight,
    Guid? ProductVariantId,
    Dictionary<string, string>? MaterialOverrides);
