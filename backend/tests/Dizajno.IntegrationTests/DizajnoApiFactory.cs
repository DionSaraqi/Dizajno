using Dizajno.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Testcontainers.PostgreSql;
using Xunit;

namespace Dizajno.IntegrationTests;

/// <summary>
/// WebApplicationFactory backed by a per-class Testcontainers Postgres instance.
/// Migrations are applied in <see cref="InitializeAsync"/> before the host boots,
/// so the in-app seeder finds the schema ready and runs idempotently.
/// </summary>
public sealed class DizajnoApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .WithDatabase("dizajno_test")
        .WithUsername("dizajno_test")
        .WithPassword("dizajno_test")
        .Build();

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();
        await ApplyMigrationsAsync();
    }

    public new async Task DisposeAsync()
    {
        await _postgres.DisposeAsync();
        await base.DisposeAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:Dizajno"] = _postgres.GetConnectionString(),
                ["JwtSettings:Issuer"] = "dizajno-test",
                ["JwtSettings:Audience"] = "dizajno-test",
                ["JwtSettings:SigningKey"] = "test-signing-key-with-at-least-32-bytes-for-hmac-sha256-tests",
                ["JwtSettings:AccessTokenLifetimeMinutes"] = "15",
                ["JwtSettings:RefreshTokenLifetimeDays"] = "30",
                ["Seed:AdminEmail"] = "admin@test.local",
                ["Seed:AdminPassword"] = "Admin1234!",
                ["Seed:AdminDisplayName"] = "Test Admin"
            });
        });
    }

    private async Task ApplyMigrationsAsync()
    {
        var options = new DbContextOptionsBuilder<DizajnoDbContext>()
            .UseNpgsql(_postgres.GetConnectionString())
            .UseSnakeCaseNamingConvention()
            .Options;
        await using var db = new DizajnoDbContext(options);
        await db.Database.MigrateAsync();
    }
}
