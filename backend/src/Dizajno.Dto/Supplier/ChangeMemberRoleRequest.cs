using System.ComponentModel.DataAnnotations;
using Dizajno.Domain.Enums;

namespace Dizajno.Dto.Supplier;

public sealed record ChangeMemberRoleRequest(
    [Required] SupplierMemberRole Role);
