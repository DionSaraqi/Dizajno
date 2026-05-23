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
}
