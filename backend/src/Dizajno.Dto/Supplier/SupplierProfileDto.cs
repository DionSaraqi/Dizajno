namespace Dizajno.Dto.Supplier;

public sealed record SupplierProfileDto(
    Guid Id,
    string Slug,
    string Name,
    string? Description,
    string? WebsiteUrl,
    string? ContactEmail,
    string? ContactPhone,
    Guid? LogoAssetId,
    string? LogoAssetUrl,
    bool IsTrusted,
    DateTime? SuspendedAt);
