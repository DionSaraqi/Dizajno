using Dizajno.Domain.Enums;

namespace Dizajno.Application.Suppliers;

/// <summary>
/// Resolves which suppliers a given user is a member of. Used by the Phase 5
/// supplier-side controllers to gate access to <c>/api/supplier/*</c> endpoints.
/// The full member-management UI lands with the Phase 7 portal; for now,
/// memberships are seeded via the admin binding endpoint.
/// </summary>
public interface ISupplierMembershipResolver
{
    Task<IReadOnlyList<SupplierMembership>> GetMembershipsAsync(
        Guid userId, CancellationToken cancellationToken);
}

public sealed record SupplierMembership(
    Guid SupplierId,
    string SupplierSlug,
    string SupplierName,
    SupplierMemberRole Role);
