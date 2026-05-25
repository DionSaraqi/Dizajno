using Dizajno.Domain.Enums;

namespace Dizajno.Dto.Auth;

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
