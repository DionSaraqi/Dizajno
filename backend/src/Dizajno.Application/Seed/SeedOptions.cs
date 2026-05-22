namespace Dizajno.Application.Seed;

public sealed class SeedOptions
{
    public const string SectionName = "Seed";

    public required string AdminEmail { get; init; }
    public required string AdminPassword { get; init; }
    public string AdminDisplayName { get; init; } = "Dizajno Admin";
}
