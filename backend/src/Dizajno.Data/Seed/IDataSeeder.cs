namespace Dizajno.Data.Seed;

public interface IDataSeeder
{
    /// <summary>
    /// Idempotently ensures baseline data exists: roles, admin user, the Dizajno
    /// supplier, the furniture category tree, and the 12 seeded furniture products.
    /// Safe to call on every startup â€” each step skips when its data already exists.
    /// </summary>
    Task SeedAsync(CancellationToken cancellationToken);
}
