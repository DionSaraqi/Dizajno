using System.ComponentModel.DataAnnotations;
using Dizajno.Domain.Enums;

namespace Dizajno.Api.Contracts;

/// <summary>
/// Phase-5 stopgap. Lets admins bind any user to a supplier so the supplier-side
/// endpoints can be exercised before the Phase 7 portal ships the member-management UI.
/// </summary>
public sealed record CreateSupplierMemberRequest(
    [Required] Guid SupplierId,
    [Required] Guid UserId,
    SupplierMemberRole Role);

public sealed record SupplierMemberDto(
    Guid Id,
    Guid SupplierId,
    string SupplierSlug,
    string SupplierName,
    Guid UserId,
    string UserEmail,
    string? UserDisplayName,
    SupplierMemberRole Role,
    DateTime CreatedAt);
