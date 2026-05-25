using System.ComponentModel.DataAnnotations;
using Dizajno.Domain.Enums;

namespace Dizajno.Dto.Admin;

public sealed record CreateSupplierInviteRequest(
    [Required] Guid SupplierId,
    [Required, EmailAddress, MaxLength(320)] string Email,
    SupplierMemberRole Role,
    int? ExpiresInDays);
