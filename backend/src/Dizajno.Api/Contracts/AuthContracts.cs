using System.ComponentModel.DataAnnotations;
using Dizajno.Domain.Enums;

namespace Dizajno.Api.Contracts;

public sealed record RegisterRequest(
    [Required, EmailAddress] string Email,
    [Required, MinLength(8)] string Password,
    string? DisplayName,
    string? Locale);

public sealed record LoginRequest(
    [Required, EmailAddress] string Email,
    [Required] string Password);

public sealed record AuthResponse(
    string AccessToken,
    DateTime AccessTokenExpiresAt,
    UserSummary User);

public sealed record UserSummary(
    Guid Id,
    string Email,
    string? DisplayName,
    string Locale,
    IReadOnlyList<string> Roles,
    IReadOnlyList<SupplierMembershipDto> SupplierMemberships);

/// <summary>
/// Surfaces which suppliers the signed-in user can act on behalf of. Phase 5
/// uses this to decide whether to render the <c>/supplier/*</c> navigation in
/// the frontend. <see cref="IsSuspended"/> is added in Phase 7a so the UI
/// can grey out portal entries for suppliers the admin has suspended.
/// </summary>
public sealed record SupplierMembershipDto(
    Guid SupplierId,
    string SupplierSlug,
    string SupplierName,
    SupplierMemberRole Role,
    bool IsSuspended);
