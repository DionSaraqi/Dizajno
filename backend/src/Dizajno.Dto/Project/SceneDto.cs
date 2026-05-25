namespace Dizajno.Dto.Project;

/// <summary>
/// Full editable room state. The client owns the ids — when the same scene is
/// re-saved the same uuids round-trip; new entities get fresh client-generated
/// uuids. The server performs a replace-all on PUT, so removed rows really
/// disappear.
/// </summary>
public sealed record SceneDto(
    IReadOnlyList<WallDto> Walls,
    IReadOnlyList<FloorDto> Floors,
    IReadOnlyList<OpeningDto> Openings,
    IReadOnlyList<PlacedItemDto> PlacedItems);
