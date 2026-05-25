namespace Dizajno.Dto.Auth;

public sealed record UserSummary(
    Guid Id,
    string Email,
    string? DisplayName,
    string Locale,
    IReadOnlyList<string> Roles,
    IReadOnlyList<SupplierMembershipDto> SupplierMemberships);
