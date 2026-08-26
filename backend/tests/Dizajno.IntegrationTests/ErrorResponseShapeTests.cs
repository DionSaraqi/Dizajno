using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Dizajno.Dto.Auth;
using FluentAssertions;
using Xunit;

namespace Dizajno.IntegrationTests;

/// <summary>
/// Locks down the *shape* of error responses, not just their status codes.
/// </summary>
/// <remarks>
/// Before these, every error assertion in the suite checked only the status, so
/// the response body was free to be anything — and it was: seven different
/// envelopes, one of which was an HTML page and one of which leaked
/// configuration keys. The client now parses these bodies, so their shape is a
/// contract worth testing.
/// </remarks>
public sealed class ErrorResponseShapeTests : IClassFixture<DizajnoApiFactory>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    private readonly DizajnoApiFactory _factory;

    public ErrorResponseShapeTests(DizajnoApiFactory factory) => _factory = factory;

    private HttpClient NewClient() => _factory.CreateClient();

    private static async Task<JsonElement> ReadJsonAsync(HttpResponseMessage response)
    {
        var raw = await response.Content.ReadAsStringAsync();
        raw.Should().NotBeNullOrWhiteSpace("an error response should carry a parseable body");
        raw.TrimStart().Should().StartWith("{",
            "the body must be JSON — an HTML error page cannot be parsed by the client");
        return JsonDocument.Parse(raw).RootElement;
    }

    // ── Identity failures are keyed by field ───────────────────────────────

    [Fact]
    public async Task Register_WithWeakPassword_ReturnsFieldKeyedErrors()
    {
        var client = NewClient();
        var response = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(
            Email: $"weak-{Guid.NewGuid():N}@dizajno.test",
            Password: "short",
            DisplayName: null,
            Locale: "sq"));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var root = await ReadJsonAsync(response);
        root.TryGetProperty("errors", out var errors).Should().BeTrue();
        // An object, not an array: the same shape the automatic model-validation
        // 400 uses, so the client needs one branch rather than two.
        errors.ValueKind.Should().Be(JsonValueKind.Object);
        errors.TryGetProperty("Password", out var passwordErrors).Should().BeTrue(
            "a password complaint must be attributable to the password input");
        passwordErrors.EnumerateArray().Should().NotBeEmpty();
    }

    [Fact]
    public async Task Register_WithDuplicateEmail_AttributesErrorToEmailField()
    {
        var client = NewClient();
        var email = $"dupe-{Guid.NewGuid():N}@dizajno.test";
        var request = new RegisterRequest(email, "Passw0rd!", "First", "sq");

        (await client.PostAsJsonAsync("/api/auth/register", request))
            .StatusCode.Should().Be(HttpStatusCode.Created);

        var response = await client.PostAsJsonAsync("/api/auth/register", request);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var root = await ReadJsonAsync(response);
        var errors = root.GetProperty("errors");
        // Identity reports this as DuplicateUserName *and* DuplicateEmail; both
        // describe the email the user typed, so both belong on that field.
        errors.TryGetProperty("Email", out var emailErrors).Should().BeTrue();
        emailErrors.EnumerateArray().Should().NotBeEmpty();
        errors.TryGetProperty("UserName", out _).Should().BeFalse(
            "there is no UserName input on the form to attach a message to");
    }

    [Fact]
    public async Task Register_WithInvalidEmail_ReturnsModelValidationMap()
    {
        var client = NewClient();
        var response = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(
            Email: "not-an-email",
            Password: "Passw0rd!",
            DisplayName: null,
            Locale: "sq"));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var root = await ReadJsonAsync(response);
        root.GetProperty("errors").ValueKind.Should().Be(JsonValueKind.Object);
        root.GetProperty("errors").TryGetProperty("Email", out _).Should().BeTrue();
    }

    // ── Bodiless results now carry a body ──────────────────────────────────

    [Fact]
    public async Task BareNotFound_CarriesAProblemDetailsBody()
    {
        var client = NewClient();
        // CatalogService returns a bare NotFoundResult for an unknown slug —
        // one of ~60 such sites, none of which were edited. UseStatusCodePages
        // supplies the body.
        var response = await client.GetAsync(
            $"/api/catalog/products/{Guid.NewGuid():N}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);

        var root = await ReadJsonAsync(response);
        root.GetProperty("status").GetInt32().Should().Be(404);
    }

    [Fact]
    public async Task MissingToken_Returns401WithAParseableBody()
    {
        var client = NewClient();
        // Emitted by the JWT middleware before the action runs — the one error
        // path that never touches a service.
        var response = await client.GetAsync("/api/auth/me");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var root = await ReadJsonAsync(response);
        root.GetProperty("status").GetInt32().Should().Be(401);
    }

    // ── Nothing leaks ──────────────────────────────────────────────────────

    [Fact]
    public async Task ErrorBodies_DoNotLeakInternalsOrCredentialKeys()
    {
        var client = NewClient();

        var responses = new[]
        {
            await client.GetAsync($"/api/catalog/products/{Guid.NewGuid():N}"),
            await client.GetAsync("/api/auth/me"),
            await client.PostAsJsonAsync("/api/auth/login",
                new LoginRequest("nobody@dizajno.test", "wrong-password")),
        };

        foreach (var response in responses)
        {
            var raw = await response.Content.ReadAsStringAsync();
            raw.Should().NotContain("AccessKeyId");
            raw.Should().NotContain("SecretAccessKey");
            raw.Should().NotContain("DIZAJNO_");
            raw.Should().NotContain("Exception");
            raw.Should().NotContain("appsettings");
            raw.Should().NotContain("<!DOCTYPE",
                "the developer exception page must never reach a client");
        }
    }

    [Fact]
    public async Task InvalidCredentials_SaysNothingAboutWhichHalfWasWrong()
    {
        var client = NewClient();
        var email = $"probe-{Guid.NewGuid():N}@dizajno.test";
        (await client.PostAsJsonAsync("/api/auth/register",
            new RegisterRequest(email, "Passw0rd!", null, "sq")))
            .StatusCode.Should().Be(HttpStatusCode.Created);

        var unknownUser = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest($"ghost-{Guid.NewGuid():N}@dizajno.test", "Passw0rd!"));
        var wrongPassword = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest(email, "Wr0ngPassword!"));

        unknownUser.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        wrongPassword.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        // Identical bodies, so the endpoint can't be used to enumerate accounts.
        var a = await unknownUser.Content.ReadAsStringAsync();
        var b = await wrongPassword.Content.ReadAsStringAsync();
        a.Should().Be(b);
    }
}
