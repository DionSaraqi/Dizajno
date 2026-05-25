namespace Dizajno.Dto.Catalog;

public sealed record CategoryDto(
    Guid Id,
    string Slug,
    string Name,
    string Family);
