using Microsoft.AspNetCore.Identity;

namespace Dizajno.Infrastructure.Identity;

public sealed class ApplicationUser : IdentityUser<Guid>
{
    public string? DisplayName { get; set; }
    /// <summary>ISO 639-1 preferred UI language. Defaults to "sq".</summary>
    public string Locale { get; set; } = "sq";
    public DateTime CreatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }
}
