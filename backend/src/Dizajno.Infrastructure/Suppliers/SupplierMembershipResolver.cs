using Dizajno.Application.Suppliers;
using Dizajno.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Dizajno.Infrastructure.Suppliers;

public sealed class SupplierMembershipResolver : ISupplierMembershipResolver
{
    private readonly DizajnoDbContext _db;

    public SupplierMembershipResolver(DizajnoDbContext db) => _db = db;

    public async Task<IReadOnlyList<SupplierMembership>> GetMembershipsAsync(
        Guid userId, CancellationToken cancellationToken)
    {
        var rows = await _db.SupplierMembers
            .AsNoTracking()
            .Where(m => m.UserId == userId)
            .Select(m => new SupplierMembership(
                m.Supplier.Id,
                m.Supplier.Slug,
                m.Supplier.Name,
                m.Role))
            .ToListAsync(cancellationToken);
        return rows;
    }
}
