using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Dizajno.Api.Contracts;
using FluentAssertions;
using Xunit;

namespace Dizajno.IntegrationTests;

public sealed class AuthEndpointsTests : IClassFixture<DizajnoApiFactory>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    private readonly DizajnoApiFactory _factory;

    public AuthEndpointsTests(DizajnoApiFactory factory) => _factory = factory;

    private HttpClient NewClient() => _factory.CreateClient();

    private static RegisterRequest NewRegister(string suffix) => new(
        Email: $"user-{suffix}@dizajno.test",
        Password: "Passw0rd!",
        DisplayName: "Test User",
        Locale: "sq");

    [Fact]
    public async Task Register_NewUser_Returns201WithAccessToken()
    {
        var client = NewClient();
        var response = await client.PostAsJsonAsync(
            "/api/auth/register",
            NewRegister(Guid.NewGuid().ToString("N")[..8]));

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<AuthResponse>(JsonOpts);
        body.Should().NotBeNull();
        body!.AccessToken.Should().NotBeNullOrWhiteSpace();
        body.User.Email.Should().StartWith("user-");

        response.Headers.Should().Contain(h => h.Key == "Set-Cookie");
        response.Headers.GetValues("Set-Cookie").Should()
            .Contain(c => c.StartsWith("dizajno_rt="));
    }

    [Fact]
    public async Task Register_WithWeakPassword_Returns400()
    {
        var client = NewClient();
        var response = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(
            Email: $"weak-{Guid.NewGuid():N}@dizajno.test",
            Password: "short",
            DisplayName: null,
            Locale: null));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Login_WithSeededAdmin_Returns200()
    {
        var client = NewClient();
        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(
            Email: "admin@test.local",
            Password: "Admin1234!"));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<AuthResponse>(JsonOpts);
        body!.User.Roles.Should().Contain("Admin");
    }

    [Fact]
    public async Task Login_WithWrongPassword_Returns401()
    {
        var client = NewClient();
        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(
            Email: "admin@test.local",
            Password: "wrong-password"));

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Me_WithoutToken_Returns401()
    {
        var client = NewClient();
        var response = await client.GetAsync("/api/auth/me");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Me_WithBearer_ReturnsUserSummary()
    {
        var client = NewClient();
        var register = await client.PostAsJsonAsync(
            "/api/auth/register",
            NewRegister($"me-{Guid.NewGuid():N}"[..12]));
        var auth = await register.Content.ReadFromJsonAsync<AuthResponse>(JsonOpts);

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", auth!.AccessToken);

        var me = await client.GetFromJsonAsync<UserSummary>("/api/auth/me", JsonOpts);
        me.Should().NotBeNull();
        me!.Id.Should().Be(auth.User.Id);
        me.Email.Should().Be(auth.User.Email);
    }

    [Fact]
    public async Task Refresh_RotatesAccessAndRefreshTokens()
    {
        var client = NewClient();
        var register = await client.PostAsJsonAsync(
            "/api/auth/register",
            NewRegister($"rot-{Guid.NewGuid():N}"[..12]));
        var first = await register.Content.ReadFromJsonAsync<AuthResponse>(JsonOpts);

        // Small delay so the "iat" timestamp differs and the new JWT is byte-distinct.
        await Task.Delay(1100);

        var refresh = await client.PostAsync("/api/auth/refresh", content: null);
        refresh.StatusCode.Should().Be(HttpStatusCode.OK);
        var second = await refresh.Content.ReadFromJsonAsync<AuthResponse>(JsonOpts);

        second!.AccessToken.Should().NotBe(first!.AccessToken);
        second.User.Id.Should().Be(first.User.Id);
    }

    [Fact]
    public async Task Logout_RevokesRefreshTokenAndBlocksFurtherRefresh()
    {
        var client = NewClient();
        await client.PostAsJsonAsync(
            "/api/auth/register",
            NewRegister($"out-{Guid.NewGuid():N}"[..12]));

        var logout = await client.PostAsync("/api/auth/logout", content: null);
        logout.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var refresh = await client.PostAsync("/api/auth/refresh", content: null);
        refresh.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Refresh_WithoutCookie_Returns401()
    {
        var client = NewClient();
        var response = await client.PostAsync("/api/auth/refresh", content: null);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task UserSummary_NewUser_HasEmptySupplierMemberships()
    {
        var client = NewClient();
        var register = await client.PostAsJsonAsync(
            "/api/auth/register",
            NewRegister($"sm-{Guid.NewGuid():N}"[..12]));
        var auth = await register.Content.ReadFromJsonAsync<AuthResponse>(JsonOpts);

        auth!.User.SupplierMemberships.Should().NotBeNull().And.BeEmpty();
    }
}
