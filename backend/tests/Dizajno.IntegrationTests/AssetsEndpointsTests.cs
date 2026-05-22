using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Dizajno.Api.Contracts;
using Dizajno.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace Dizajno.IntegrationTests;

public sealed class AssetsEndpointsTests : IClassFixture<DizajnoApiFactory>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web)
    {
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() }
    };

    private readonly DizajnoApiFactory _factory;

    public AssetsEndpointsTests(DizajnoApiFactory factory) => _factory = factory;

    private HttpClient NewClient() => _factory.CreateClient();

    private async Task<string> LoginAsAdminAsync(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(
            Email: "admin@test.local",
            Password: "Admin1234!"));
        response.EnsureSuccessStatusCode();
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>(JsonOpts);
        return auth!.AccessToken;
    }

    private async Task<string> RegisterRegularUserAsync(HttpClient client)
    {
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var response = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(
            Email: $"user-{suffix}@dizajno.test",
            Password: "Passw0rd!",
            DisplayName: "Regular User",
            Locale: "sq"));
        response.EnsureSuccessStatusCode();
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>(JsonOpts);
        return auth!.AccessToken;
    }

    [Fact]
    public async Task Presign_WithoutAuth_Returns401()
    {
        var client = NewClient();
        var response = await client.PostAsJsonAsync("/api/admin/assets/presign", new PresignAssetUploadRequest(
            Kind: AssetKind.Glb,
            ContentType: "model/gltf-binary",
            SizeBytes: 1024,
            OriginalFileName: "sofa.glb",
            ChecksumSha256: null));

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Presign_AsNonAdminUser_Returns403()
    {
        var client = NewClient();
        var token = await RegisterRegularUserAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.PostAsJsonAsync("/api/admin/assets/presign", new PresignAssetUploadRequest(
            Kind: AssetKind.Glb,
            ContentType: "model/gltf-binary",
            SizeBytes: 1024,
            OriginalFileName: "sofa.glb",
            ChecksumSha256: null));

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Presign_AsAdmin_ReturnsPresignedUrlAndKey()
    {
        var client = NewClient();
        var token = await LoginAsAdminAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.PostAsJsonAsync("/api/admin/assets/presign", new PresignAssetUploadRequest(
            Kind: AssetKind.Glb,
            ContentType: "model/gltf-binary",
            SizeBytes: 12_345,
            OriginalFileName: "Sofa Model.glb",
            ChecksumSha256: null));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<PresignAssetUploadResponse>(JsonOpts);

        body.Should().NotBeNull();
        body!.Key.Should().StartWith("assets/glb/").And.EndWith(".glb");
        body.UploadUrl.Should().StartWith("https://fake-r2.test.local/");
        body.PublicUrl.Should().Be($"https://assets.test.local/{body.Key}");
        body.ExpiresAt.Should().BeAfter(DateTime.UtcNow);
        body.RequiredHeaders.Should().ContainKey("Content-Type")
            .WhoseValue.Should().Be("model/gltf-binary");
        body.RequiredHeaders["Content-Length"].Should().Be("12345");
    }

    [Fact]
    public async Task Presign_WithInvalidMimeForKind_Returns400()
    {
        var client = NewClient();
        var token = await LoginAsAdminAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // GLBs are application/octet-stream or model/gltf-binary, never image/png.
        var response = await client.PostAsJsonAsync("/api/admin/assets/presign", new PresignAssetUploadRequest(
            Kind: AssetKind.Glb,
            ContentType: "image/png",
            SizeBytes: 1024,
            OriginalFileName: "wat.png",
            ChecksumSha256: null));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Presign_WithOversizedPayload_Returns400()
    {
        var client = NewClient();
        var token = await LoginAsAdminAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // Glb max is 50 MB; 51 MB should be rejected.
        var response = await client.PostAsJsonAsync("/api/admin/assets/presign", new PresignAssetUploadRequest(
            Kind: AssetKind.Glb,
            ContentType: "model/gltf-binary",
            SizeBytes: 51L * 1024 * 1024,
            OriginalFileName: "huge.glb",
            ChecksumSha256: null));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Presign_WithZeroSize_Returns400()
    {
        var client = NewClient();
        var token = await LoginAsAdminAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.PostAsJsonAsync("/api/admin/assets/presign", new PresignAssetUploadRequest(
            Kind: AssetKind.Glb,
            ContentType: "model/gltf-binary",
            SizeBytes: 0,
            OriginalFileName: "empty.glb",
            ChecksumSha256: null));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateAsset_WithoutAuth_Returns401()
    {
        var client = NewClient();
        var response = await client.PostAsJsonAsync("/api/admin/assets", new CreateAssetRequest(
            Key: "assets/glb/whatever.glb",
            Kind: AssetKind.Glb,
            MimeType: "model/gltf-binary",
            SizeBytes: 1024,
            ChecksumSha256: null,
            ProductId: null,
            VariantId: null,
            OwnerSupplierId: null,
            SortOrder: 0));

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task CreateAsset_AsAdmin_PersistsAndReturnsAssetWithPublicUrl()
    {
        var client = NewClient();
        var token = await LoginAsAdminAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var key = $"assets/glb/{Guid.NewGuid():N}.glb";
        var response = await client.PostAsJsonAsync("/api/admin/assets", new CreateAssetRequest(
            Key: key,
            Kind: AssetKind.Glb,
            MimeType: "model/gltf-binary",
            SizeBytes: 9_876_543,
            ChecksumSha256: "abc123",
            ProductId: null,
            VariantId: null,
            OwnerSupplierId: null,
            SortOrder: 0));

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<AssetDto>(JsonOpts);

        body.Should().NotBeNull();
        body!.Id.Should().NotBeEmpty();
        body.Kind.Should().Be(AssetKind.Glb);
        body.Url.Should().Be($"https://assets.test.local/{key}");
        body.SizeBytes.Should().Be(9_876_543);
        body.ChecksumSha256.Should().Be("abc123");
    }
}
