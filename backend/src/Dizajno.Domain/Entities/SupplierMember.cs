using Dizajno.Domain.Enums;

namespace Dizajno.Domain.Entities;

public sealed class SupplierMember
{
    public Guid Id { get; set; }
    public Guid SupplierId { get; set; }
    public Guid UserId { get; set; }
    public SupplierMemberRole Role { get; set; }
    public DateTime CreatedAt { get; set; }

    public Supplier Supplier { get; set; } = null!;
}
