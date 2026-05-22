using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Dizajno.Api.Contracts;
using Dizajno.Domain.Enums;
using Dizajno.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Dizajno.IntegrationTests;

public sealed class ProjectsEndpointsTests : IClassFixture<DizajnoApiFactory>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web)
    {
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() }
    };

    private readonly DizajnoApiFactory _factory;

    public ProjectsEndpointsTests(DizajnoApiFactory factory) => _factory = factory;

    private HttpClient NewClient() => _factory.CreateClient();

    private async Task<(HttpClient client, AuthResponse auth)> NewAuthedClientAsync(string suffix)
    {
        var client = NewClient();
        var response = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(
            Email: $"projects-{suffix}@dizajno.test",
            Password: "Passw0rd!",
            DisplayName: "Projects Test User",
            Locale: "sq"));
        response.EnsureSuccessStatusCode();
        var auth = (await response.Content.ReadFromJsonAsync<AuthResponse>(JsonOpts))!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return (client, auth);
    }

    private async Task<Guid> GetAnyVariantIdAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DizajnoDbContext>();
        return await db.ProductVariants.AsNoTracking().Select(v => v.Id).FirstAsync();
    }

    [Fact]
    public async Task List_WithoutAuth_Returns401()
    {
        var client = NewClient();
        var response = await client.GetAsync("/api/projects");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Create_ReturnsEmptySceneAndShowsInList()
    {
        var (client, _) = await NewAuthedClientAsync(Guid.NewGuid().ToString("N")[..8]);

        var created = await client.PostAsJsonAsync("/api/projects",
            new CreateProjectRequest("Living Room"));
        created.StatusCode.Should().Be(HttpStatusCode.Created);
        var detail = (await created.Content.ReadFromJsonAsync<ProjectDetailDto>(JsonOpts))!;
        detail.Name.Should().Be("Living Room");
        detail.Scene.Walls.Should().BeEmpty();
        detail.Scene.Floors.Should().BeEmpty();
        detail.Scene.Openings.Should().BeEmpty();
        detail.Scene.PlacedItems.Should().BeEmpty();
        detail.Versions.Should().BeEmpty();

        var list = await client.GetFromJsonAsync<List<ProjectSummaryDto>>("/api/projects", JsonOpts);
        list.Should().ContainSingle(p => p.Id == detail.Id && p.Name == "Living Room");
    }

    [Fact]
    public async Task Get_ForeignProject_Returns404()
    {
        var (ownerClient, _) = await NewAuthedClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var created = (await (await ownerClient.PostAsJsonAsync("/api/projects",
            new CreateProjectRequest("Mine"))).Content.ReadFromJsonAsync<ProjectDetailDto>(JsonOpts))!;

        var (otherClient, _) = await NewAuthedClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var response = await otherClient.GetAsync($"/api/projects/{created.Id}");
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ReplaceScene_PersistsWallsFloorsOpeningsItems_AndIsReplaceAll()
    {
        var (client, _) = await NewAuthedClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var variantId = await GetAnyVariantIdAsync();
        var created = (await (await client.PostAsJsonAsync("/api/projects",
            new CreateProjectRequest("Scene Test"))).Content.ReadFromJsonAsync<ProjectDetailDto>(JsonOpts))!;

        var wallId = Guid.NewGuid();
        var firstScene = new SceneDto(
            Walls: new[] { new WallDto(wallId, 0m, 0m, 4m, 0m, 0.1m, 2.5m) },
            Floors: new[] { new FloorDto(Guid.NewGuid(),
                new List<List<decimal>> { new() { 0m, 0m }, new() { 4m, 0m }, new() { 4m, 4m }, new() { 0m, 4m } }) },
            Openings: new[]
            {
                new OpeningDto(Guid.NewGuid(), wallId, OpeningType.Door,
                    1m, 0.9m, 2.1m, 0m, null, null)
            },
            PlacedItems: new[]
            {
                new PlacedItemDto(Guid.NewGuid(), variantId,
                    1.5m, 1.5m, 0m, 1m, 0.6m, 0.6m, 0.45m, null, null)
            });

        var put = await client.PutAsJsonAsync($"/api/projects/{created.Id}/scene",
            new ReplaceSceneRequest(firstScene));
        put.StatusCode.Should().Be(HttpStatusCode.OK);
        var afterFirst = (await put.Content.ReadFromJsonAsync<ProjectDetailDto>(JsonOpts))!;
        afterFirst.Scene.Walls.Should().HaveCount(1);
        afterFirst.Scene.Floors.Should().HaveCount(1);
        afterFirst.Scene.Openings.Should().HaveCount(1);
        afterFirst.Scene.PlacedItems.Should().HaveCount(1);

        // Replace with empty scene → everything should be wiped.
        var empty = new SceneDto(
            Array.Empty<WallDto>(), Array.Empty<FloorDto>(),
            Array.Empty<OpeningDto>(), Array.Empty<PlacedItemDto>());
        var wipe = await client.PutAsJsonAsync($"/api/projects/{created.Id}/scene",
            new ReplaceSceneRequest(empty));
        wipe.StatusCode.Should().Be(HttpStatusCode.OK);

        var afterWipe = await client.GetFromJsonAsync<ProjectDetailDto>(
            $"/api/projects/{created.Id}", JsonOpts);
        afterWipe!.Scene.Walls.Should().BeEmpty();
        afterWipe.Scene.Floors.Should().BeEmpty();
        afterWipe.Scene.Openings.Should().BeEmpty();
        afterWipe.Scene.PlacedItems.Should().BeEmpty();
    }

    [Fact]
    public async Task ReplaceScene_WithOpeningReferencingMissingWall_Returns400()
    {
        var (client, _) = await NewAuthedClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var created = (await (await client.PostAsJsonAsync("/api/projects",
            new CreateProjectRequest("Bad Scene"))).Content.ReadFromJsonAsync<ProjectDetailDto>(JsonOpts))!;

        var orphanOpening = new SceneDto(
            Walls: Array.Empty<WallDto>(),
            Floors: Array.Empty<FloorDto>(),
            Openings: new[]
            {
                new OpeningDto(Guid.NewGuid(), Guid.NewGuid(), OpeningType.Window,
                    0.5m, 1m, 1m, 0.9m, null, null)
            },
            PlacedItems: Array.Empty<PlacedItemDto>());

        var put = await client.PutAsJsonAsync($"/api/projects/{created.Id}/scene",
            new ReplaceSceneRequest(orphanOpening));
        put.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateVersion_ThenRestore_RoundsTripsScene()
    {
        var (client, _) = await NewAuthedClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var created = (await (await client.PostAsJsonAsync("/api/projects",
            new CreateProjectRequest("Versioned"))).Content.ReadFromJsonAsync<ProjectDetailDto>(JsonOpts))!;

        // Save scene A.
        var wallId = Guid.NewGuid();
        var sceneA = new SceneDto(
            Walls: new[] { new WallDto(wallId, 0m, 0m, 3m, 0m, 0.1m, 2.4m) },
            Floors: Array.Empty<FloorDto>(),
            Openings: Array.Empty<OpeningDto>(),
            PlacedItems: Array.Empty<PlacedItemDto>());
        (await client.PutAsJsonAsync($"/api/projects/{created.Id}/scene",
            new ReplaceSceneRequest(sceneA))).EnsureSuccessStatusCode();

        // Snapshot it.
        var versionResp = await client.PostAsJsonAsync(
            $"/api/projects/{created.Id}/versions",
            new CreateVersionRequest("Before remodel"));
        versionResp.StatusCode.Should().Be(HttpStatusCode.Created);
        var version = (await versionResp.Content.ReadFromJsonAsync<ProjectVersionSummaryDto>(JsonOpts))!;

        // Replace with scene B.
        var sceneB = new SceneDto(
            Walls: new[]
            {
                new WallDto(Guid.NewGuid(), 0m, 0m, 5m, 0m, 0.1m, 2.4m),
                new WallDto(Guid.NewGuid(), 5m, 0m, 5m, 5m, 0.1m, 2.4m)
            },
            Floors: Array.Empty<FloorDto>(),
            Openings: Array.Empty<OpeningDto>(),
            PlacedItems: Array.Empty<PlacedItemDto>());
        (await client.PutAsJsonAsync($"/api/projects/{created.Id}/scene",
            new ReplaceSceneRequest(sceneB))).EnsureSuccessStatusCode();

        // Restore version → scene should be back to A (with the original wall id).
        var restore = await client.PostAsync(
            $"/api/projects/{created.Id}/versions/{version.Id}/restore",
            content: null);
        restore.StatusCode.Should().Be(HttpStatusCode.OK);
        var restored = (await restore.Content.ReadFromJsonAsync<ProjectDetailDto>(JsonOpts))!;

        restored.Scene.Walls.Should().HaveCount(1);
        restored.Scene.Walls[0].Id.Should().Be(wallId);
        restored.Scene.Walls[0].EndX.Should().Be(3m);
    }

    [Fact]
    public async Task Delete_SoftRemovesFromList_AndBlocksFurtherAccess()
    {
        var (client, _) = await NewAuthedClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var created = (await (await client.PostAsJsonAsync("/api/projects",
            new CreateProjectRequest("Throwaway"))).Content.ReadFromJsonAsync<ProjectDetailDto>(JsonOpts))!;

        var delete = await client.DeleteAsync($"/api/projects/{created.Id}");
        delete.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var list = await client.GetFromJsonAsync<List<ProjectSummaryDto>>("/api/projects", JsonOpts);
        list.Should().NotContain(p => p.Id == created.Id);

        var get = await client.GetAsync($"/api/projects/{created.Id}");
        get.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task UpdateName_PersistsAndAppearsInList()
    {
        var (client, _) = await NewAuthedClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var created = (await (await client.PostAsJsonAsync("/api/projects",
            new CreateProjectRequest("Old name"))).Content.ReadFromJsonAsync<ProjectDetailDto>(JsonOpts))!;

        var renamed = await client.PutAsJsonAsync($"/api/projects/{created.Id}",
            new UpdateProjectRequest("New name", null));
        renamed.StatusCode.Should().Be(HttpStatusCode.OK);
        var summary = (await renamed.Content.ReadFromJsonAsync<ProjectSummaryDto>(JsonOpts))!;
        summary.Name.Should().Be("New name");

        var list = (await client.GetFromJsonAsync<List<ProjectSummaryDto>>("/api/projects", JsonOpts))!;
        list.First(p => p.Id == created.Id).Name.Should().Be("New name");
    }
}
