using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Dizajno.Api.Contracts;
using Dizajno.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace Dizajno.IntegrationTests;

public sealed class SharingEndpointsTests : IClassFixture<DizajnoApiFactory>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web)
    {
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() }
    };

    private readonly DizajnoApiFactory _factory;

    public SharingEndpointsTests(DizajnoApiFactory factory) => _factory = factory;

    private HttpClient NewClient() => _factory.CreateClient();

    private async Task<(HttpClient client, AuthResponse auth)> NewAuthedClientAsync(string suffix)
    {
        var client = NewClient();
        var response = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(
            Email: $"share-{suffix}@dizajno.test",
            Password: "Passw0rd!",
            DisplayName: $"Sharer {suffix}",
            Locale: "sq"));
        response.EnsureSuccessStatusCode();
        var auth = (await response.Content.ReadFromJsonAsync<AuthResponse>(JsonOpts))!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return (client, auth);
    }

    private async Task<ProjectDetailDto> NewProjectAsync(HttpClient client, string name = "Shared room")
    {
        var resp = await client.PostAsJsonAsync("/api/projects", new CreateProjectRequest(name));
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<ProjectDetailDto>(JsonOpts))!;
    }

    [Fact]
    public async Task CreateLinkShare_ReturnsRandomTokenAndListsIt()
    {
        var (client, _) = await NewAuthedClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var project = await NewProjectAsync(client);

        var create = await client.PostAsJsonAsync(
            $"/api/projects/{project.Id}/shares",
            new CreateShareRequest(ShareMode.View, ShareKind.Link, null, null));
        create.StatusCode.Should().Be(HttpStatusCode.Created);
        var share = (await create.Content.ReadFromJsonAsync<ShareSummaryDto>(JsonOpts))!;
        share.Token.Should().NotBeNullOrWhiteSpace();
        share.Mode.Should().Be(ShareMode.View);
        share.InvitedEmail.Should().BeNull();

        var list = (await client.GetFromJsonAsync<List<ShareSummaryDto>>(
            $"/api/projects/{project.Id}/shares", JsonOpts))!;
        list.Should().ContainSingle(s => s.Id == share.Id);
    }

    [Fact]
    public async Task CreateEmailShare_StoresLowercasedEmail()
    {
        var (client, _) = await NewAuthedClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var project = await NewProjectAsync(client);

        var create = await client.PostAsJsonAsync(
            $"/api/projects/{project.Id}/shares",
            new CreateShareRequest(ShareMode.Comment, ShareKind.Email, "Friend@Example.COM", null));
        create.StatusCode.Should().Be(HttpStatusCode.Created);
        var share = (await create.Content.ReadFromJsonAsync<ShareSummaryDto>(JsonOpts))!;
        share.InvitedEmail.Should().Be("friend@example.com");
        share.Token.Should().BeNull();
    }

    [Fact]
    public async Task PublicLoadShare_ReturnsSceneWithoutAuth()
    {
        var (owner, _) = await NewAuthedClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var project = await NewProjectAsync(owner);
        var share = (await (await owner.PostAsJsonAsync(
            $"/api/projects/{project.Id}/shares",
            new CreateShareRequest(ShareMode.View, ShareKind.Link, null, null)))
            .Content.ReadFromJsonAsync<ShareSummaryDto>(JsonOpts))!;

        var anonymous = NewClient();
        var load = await anonymous.GetAsync($"/api/share/{share.Token}");
        load.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = (await load.Content.ReadFromJsonAsync<SharedProjectDto>(JsonOpts))!;
        body.ProjectId.Should().Be(project.Id);
        body.Name.Should().Be(project.Name);
        body.Mode.Should().Be(ShareMode.View);
    }

    [Fact]
    public async Task PublicLoadShare_AfterRevoke_Returns404()
    {
        var (owner, _) = await NewAuthedClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var project = await NewProjectAsync(owner);
        var share = (await (await owner.PostAsJsonAsync(
            $"/api/projects/{project.Id}/shares",
            new CreateShareRequest(ShareMode.View, ShareKind.Link, null, null)))
            .Content.ReadFromJsonAsync<ShareSummaryDto>(JsonOpts))!;

        var revoke = await owner.DeleteAsync($"/api/projects/{project.Id}/shares/{share.Id}");
        revoke.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var load = await NewClient().GetAsync($"/api/share/{share.Token}");
        load.StatusCode.Should().Be(HttpStatusCode.NoContent.Equals(HttpStatusCode.NoContent)
            ? HttpStatusCode.NotFound : HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task PostComment_ViewModeShare_Returns403()
    {
        var (owner, _) = await NewAuthedClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var project = await NewProjectAsync(owner);
        var share = (await (await owner.PostAsJsonAsync(
            $"/api/projects/{project.Id}/shares",
            new CreateShareRequest(ShareMode.View, ShareKind.Link, null, null)))
            .Content.ReadFromJsonAsync<ShareSummaryDto>(JsonOpts))!;

        var resp = await NewClient().PostAsJsonAsync(
            $"/api/share/{share.Token}/comments",
            new PostCommentRequest("Hi", "Guest", null, null, null));
        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task PostComment_AsAnonymous_RequiresGuestName()
    {
        var (owner, _) = await NewAuthedClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var project = await NewProjectAsync(owner);
        var share = (await (await owner.PostAsJsonAsync(
            $"/api/projects/{project.Id}/shares",
            new CreateShareRequest(ShareMode.Comment, ShareKind.Link, null, null)))
            .Content.ReadFromJsonAsync<ShareSummaryDto>(JsonOpts))!;

        var resp = await NewClient().PostAsJsonAsync(
            $"/api/share/{share.Token}/comments",
            new PostCommentRequest("Hi", null, null, null, null));
        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task PostComment_RoundTripsAnchorAndShowsUpInOwnerInbox()
    {
        var (owner, _) = await NewAuthedClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var project = await NewProjectAsync(owner);
        var share = (await (await owner.PostAsJsonAsync(
            $"/api/projects/{project.Id}/shares",
            new CreateShareRequest(ShareMode.Comment, ShareKind.Link, null, null)))
            .Content.ReadFromJsonAsync<ShareSummaryDto>(JsonOpts))!;

        var anchor = JsonSerializer.SerializeToElement(new { type = "point", x = 1.5, z = 2.0 });
        var post = await NewClient().PostAsJsonAsync(
            $"/api/share/{share.Token}/comments",
            new PostCommentRequest("Move the sofa here", "Guest", "g@example.com", null, anchor));
        post.StatusCode.Should().Be(HttpStatusCode.Created);
        var posted = (await post.Content.ReadFromJsonAsync<CommentDto>(JsonOpts))!;
        posted.GuestName.Should().Be("Guest");
        posted.Anchor.Should().NotBeNull();
        posted.Anchor!.Value.GetProperty("type").GetString().Should().Be("point");

        // Owner inbox
        var inbox = (await owner.GetFromJsonAsync<List<CommentDto>>(
            $"/api/projects/{project.Id}/comments", JsonOpts))!;
        inbox.Should().ContainSingle(c => c.Id == posted.Id);
    }

    [Fact]
    public async Task PostComment_AsSignedInUser_RecordsAuthorUserId()
    {
        var (owner, _) = await NewAuthedClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var project = await NewProjectAsync(owner);
        var share = (await (await owner.PostAsJsonAsync(
            $"/api/projects/{project.Id}/shares",
            new CreateShareRequest(ShareMode.Comment, ShareKind.Link, null, null)))
            .Content.ReadFromJsonAsync<ShareSummaryDto>(JsonOpts))!;

        var (otherClient, otherAuth) = await NewAuthedClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var post = await otherClient.PostAsJsonAsync(
            $"/api/share/{share.Token}/comments",
            new PostCommentRequest("Looking good", null, null, null, null));
        post.StatusCode.Should().Be(HttpStatusCode.Created);
        var posted = (await post.Content.ReadFromJsonAsync<CommentDto>(JsonOpts))!;
        posted.AuthorUserId.Should().Be(otherAuth.User.Id);
        posted.GuestName.Should().BeNull();
    }
}
