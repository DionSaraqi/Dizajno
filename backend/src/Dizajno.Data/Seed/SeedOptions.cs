namespace Dizajno.Data.Seed;

public sealed class SeedOptions
{
    public const string SectionName = "Seed";

    public required string AdminEmail { get; init; }
    public required string AdminPassword { get; init; }
    public string AdminDisplayName { get; init; } = "Dizajno Admin";

    /// <summary>
    /// When true, seeds one demo account per role (supplier Owner, supplier
    /// Staff, plain customer — all sharing <see cref="AdminPassword"/>) and
    /// binds the supplier accounts to the seeded 'dizajno' supplier.
    /// Off by default so production and test databases never get them;
    /// enabled in appsettings.Development.json.
    /// </summary>
    public bool SeedDemoAccounts { get; init; }
}
