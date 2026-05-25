using Dizajno.Domain.Enums;

namespace Dizajno.Application.Interfaces;

/// <summary>
/// Resolves which suppliers a given user is a member of. Used by the Phase 5
/// supplier-side controllers to gate access to <c>/api/supplier/*</c> endpoints
/// and (Phase 7a) to fold the suspended flag into the user summary.
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
    SupplierMemberRole Role,
    bool IsSuspended);
