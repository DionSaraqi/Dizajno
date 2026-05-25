namespace Dizajno.Dto.Project;

public sealed record WallDto(
    Guid Id,
    decimal StartX,
    decimal StartZ,
    decimal EndX,
    decimal EndZ,
    decimal Thickness,
    decimal Height,
    Guid? PaintProductVariantId = null);
