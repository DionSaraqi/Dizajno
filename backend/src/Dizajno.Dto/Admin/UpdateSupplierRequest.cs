using System.ComponentModel.DataAnnotations;

namespace Dizajno.Dto.Admin;

public sealed record UpdateSupplierRequest(
    [Required, MaxLength(200)] string Name,
    string? Description,
    [MaxLength(500)] string? WebsiteUrl,
    [EmailAddress, MaxLength(320)] string? ContactEmail,
    [MaxLength(50)] string? ContactPhone);
