using Dizajno.Domain.Enums;

namespace Dizajno.Application.Suppliers;

public static class SupplierMembershipExtensions
{
    /// <summary>
    /// Returns the set of supplier ids the user can currently act on behalf of —
    /// i.e. all their memberships <em>except</em> suspended suppliers. Use this
    /// at supplier-side gating sites so suspended suppliers' members can't
    /// touch their portal (assets, quotes, etc.) until the admin restores them.
    /// </summary>
    public static HashSet<Guid> ActiveSupplierIds(this IEnumerable<SupplierMembership> memberships) =>
        memberships.Where(m => !m.IsSuspended).Select(m => m.SupplierId).ToHashSet();

    /// <summary>
    /// True if the user has an active (non-suspended) membership in the
    /// supplier with any role. Cheaper than building the full set when the
    /// caller only needs a yes/no on one supplier id.
    /// </summary>
    public static bool IsActiveMemberOf(this IEnumerable<SupplierMembership> memberships, Guid supplierId) =>
        memberships.Any(m => m.SupplierId == supplierId && !m.IsSuspended);

    /// <summary>
    /// True if the user is an active Owner of the supplier. Phase 7b Owner-only
    /// endpoints (member management, profile edit) use this; Staff can edit
    /// catalog and respond to quotes but can't touch member rows or the
    /// supplier profile.
    /// </summary>
    public static bool IsActiveOwnerOf(this IEnumerable<SupplierMembership> memberships, Guid supplierId) =>
        memberships.Any(m => m.SupplierId == supplierId && !m.IsSuspended && m.Role == SupplierMemberRole.Owner);
}
