using System.ComponentModel.DataAnnotations;

namespace Dizajno.Dto.Admin;

public sealed record CreateSupplierRequest(
    [Required, MaxLength(120)] string Slug,
    [Required, MaxLength(200)] string Name,
    string? Description,
    [MaxLength(500)] string? WebsiteUrl,
    [EmailAddress, MaxLength(320)] string? ContactEmail,
    [MaxLength(50)] string? ContactPhone);
