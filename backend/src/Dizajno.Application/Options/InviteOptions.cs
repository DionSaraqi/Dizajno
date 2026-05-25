namespace Dizajno.Application.Options;

/// <summary>Configuration for invite URLs and default lifetimes. Bound from <c>Invites</c> in appsettings.</summary>
public sealed class InviteOptions
{
    /// <summary>URL template containing the literal <c>{token}</c> placeholder; defaults to the frontend dev port.</summary>
    public string AcceptUrlTemplate { get; set; } = "http://localhost:3000/invite/{token}";
    public int DefaultLifetimeDays { get; set; } = 14;
}
