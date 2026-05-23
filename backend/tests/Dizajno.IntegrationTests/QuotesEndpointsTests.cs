using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Dizajno.Api.Contracts;
using Dizajno.Domain.Entities;
using Dizajno.Domain.Enums;
using Dizajno.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Dizajno.IntegrationTests;

public sealed class QuotesEndpointsTests : IClassFixture<DizajnoApiFactory>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web)
    {
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() }
    };

    private readonly DizajnoApiFactory _factory;

    public QuotesEndpointsTests(DizajnoApiFactory factory) => _factory = factory;

    private HttpClient NewClient() => _factory.CreateClient();

    private async Task<AuthResponse> RegisterUserAsync(HttpClient client, string suffix)
    {
        var response = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(
            Email: $"quotes-{suffix}@dizajno.test",
            Password: "Passw0rd!",
            DisplayName: $"Quotes {suffix}",
            Locale: "sq"));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<AuthResponse>(JsonOpts))!;
    }

    private async Task<(HttpClient client, AuthResponse auth)> NewAuthedClientAsync(string suffix)
    {
        var client = NewClient();
        var auth = await RegisterUserAsync(client, suffix);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return (client, auth);
    }

    private async Task<string> LoginAsAdminAsync(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(
            Email: "admin@test.local",
            Password: "Admin1234!"));
        response.EnsureSuccessStatusCode();
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>(JsonOpts);
        return auth!.AccessToken;
    }

    private async Task<Guid> GetDizajnoSupplierIdAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DizajnoDbContext>();
        return await db.Suppliers.Where(s => s.Slug == "dizajno").Select(s => s.Id).SingleAsync();
    }

    /// <summary>
    /// Seed-helper: create a project with a single placed item for the supplied
    /// product slug. Returns the new project's id so the caller can quote it.
    /// </summary>
    private async Task<Guid> CreateProjectWithPlacedItemAsync(
        HttpClient client, string projectName, string productSlug,
        decimal? scaleW = null, decimal? scaleD = null, decimal? scaleH = null)
    {
        var create = await client.PostAsJsonAsync("/api/projects",
            new CreateProjectRequest(projectName), JsonOpts);
        create.EnsureSuccessStatusCode();
        var project = (await create.Content.ReadFromJsonAsync<ProjectDetailDto>(JsonOpts))!;

        Guid variantId;
        decimal stockW, stockD, stockH;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<DizajnoDbContext>();
            var variant = await db.Products
                .Where(p => p.Slug == productSlug)
                .SelectMany(p => p.Variants)
                .Select(v => new { v.Id, v.Width, v.Depth, v.Height })
                .FirstAsync();
            variantId = variant.Id;
            stockW = variant.Width;
            stockD = variant.Depth;
            stockH = variant.Height;
        }

        var placed = new PlacedItemDto(
            Id: Guid.NewGuid(),
            ProductVariantId: variantId,
            PositionX: 1m,
            PositionZ: 1m,
            Rotation: 0m,
            Scale: 1m,
            ScaledWidth: scaleW ?? stockW,
            ScaledDepth: scaleD ?? stockD,
            ScaledHeight: scaleH ?? stockH,
            MaterialColors: new Dictionary<string, string> { ["Body"] = "#abcdef" },
            MaterialTextures: null);

        var sceneResponse = await client.PutAsJsonAsync(
            $"/api/projects/{project.Id}/scene",
            new ReplaceSceneRequest(new SceneDto(
                Array.Empty<WallDto>(),
                Array.Empty<FloorDto>(),
                Array.Empty<OpeningDto>(),
                new[] { placed })),
            JsonOpts);
        sceneResponse.EnsureSuccessStatusCode();
        return project.Id;
    }

    [Fact]
    public async Task Create_EmptyProject_Returns400()
    {
        var (client, _) = await NewAuthedClientAsync($"empty-{Guid.NewGuid():N}"[..18]);
        var create = await client.PostAsJsonAsync("/api/projects",
            new CreateProjectRequest("Empty"), JsonOpts);
        var project = (await create.Content.ReadFromJsonAsync<ProjectDetailDto>(JsonOpts))!;

        var response = await client.PostAsJsonAsync(
            $"/api/projects/{project.Id}/quotes",
            new CreateQuoteRequest(Message: "Anyone?"));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Create_PlacedItemsExist_FansOutPerSupplier()
    {
        var (client, _) = await NewAuthedClientAsync($"fan-{Guid.NewGuid():N}"[..18]);
        var projectId = await CreateProjectWithPlacedItemAsync(client, "Quote room", "sofa");

        var response = await client.PostAsJsonAsync(
            $"/api/projects/{projectId}/quotes",
            new CreateQuoteRequest(Message: "Please price this."));
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var detail = (await response.Content.ReadFromJsonAsync<QuoteDetailDto>(JsonOpts))!;
        detail.Status.Should().Be(QuoteStatus.Open);
        detail.Message.Should().Be("Please price this.");
        detail.Requests.Should().ContainSingle();
        var req = detail.Requests[0];
        req.SupplierSlug.Should().Be("dizajno");
        req.Status.Should().Be(QuoteRequestStatus.Pending);
        req.Lines.Should().ContainSingle();
        req.Lines[0].VariantSnapshot.GetProperty("productSlug").GetString().Should().Be("sofa");
        req.Lines[0].IsCustomSize.Should().BeFalse();
        req.Response.Should().BeNull();
    }

    [Fact]
    public async Task Create_ForeignProject_Returns404()
    {
        var (owner, _) = await NewAuthedClientAsync($"own-{Guid.NewGuid():N}"[..18]);
        var projectId = await CreateProjectWithPlacedItemAsync(owner, "Mine", "chair");

        var (other, _) = await NewAuthedClientAsync($"other-{Guid.NewGuid():N}"[..18]);
        var response = await other.PostAsJsonAsync(
            $"/api/projects/{projectId}/quotes",
            new CreateQuoteRequest(Message: null));
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task List_FiltersByStatus_AndShowsRollupCounts()
    {
        var (client, _) = await NewAuthedClientAsync($"list-{Guid.NewGuid():N}"[..18]);
        var projectId = await CreateProjectWithPlacedItemAsync(client, "L", "sofa");

        var first = await client.PostAsJsonAsync($"/api/projects/{projectId}/quotes",
            new CreateQuoteRequest(null));
        first.EnsureSuccessStatusCode();
        var firstDetail = (await first.Content.ReadFromJsonAsync<QuoteDetailDto>(JsonOpts))!;

        var cancel = await client.PostAsync($"/api/quotes/{firstDetail.Id}/cancel", content: null);
        cancel.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var open = await client.GetFromJsonAsync<List<QuoteSummaryDto>>(
            "/api/quotes?status=Open", JsonOpts);
        open.Should().BeEmpty();

        var cancelled = await client.GetFromJsonAsync<List<QuoteSummaryDto>>(
            "/api/quotes?status=Cancelled", JsonOpts);
        cancelled.Should().ContainSingle().Which.Id.Should().Be(firstDetail.Id);
        cancelled![0].SupplierCount.Should().Be(1);
    }

    [Fact]
    public async Task Cancel_FlipsPendingRequestsToExpired()
    {
        var (client, _) = await NewAuthedClientAsync($"cancel-{Guid.NewGuid():N}"[..18]);
        var projectId = await CreateProjectWithPlacedItemAsync(client, "C", "sofa");
        var quote = (await (await client.PostAsJsonAsync(
            $"/api/projects/{projectId}/quotes", new CreateQuoteRequest(null)))
            .Content.ReadFromJsonAsync<QuoteDetailDto>(JsonOpts))!;

        var cancel = await client.PostAsync($"/api/quotes/{quote.Id}/cancel", content: null);
        cancel.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var refreshed = await client.GetFromJsonAsync<QuoteDetailDto>(
            $"/api/quotes/{quote.Id}", JsonOpts);
        refreshed!.Status.Should().Be(QuoteStatus.Cancelled);
        refreshed.Requests[0].Status.Should().Be(QuoteRequestStatus.Expired);
    }

    [Fact]
    public async Task Close_BeforeAnyResponse_Returns409()
    {
        var (client, _) = await NewAuthedClientAsync($"close-{Guid.NewGuid():N}"[..18]);
        var projectId = await CreateProjectWithPlacedItemAsync(client, "K", "sofa");
        var quote = (await (await client.PostAsJsonAsync(
            $"/api/projects/{projectId}/quotes", new CreateQuoteRequest(null)))
            .Content.ReadFromJsonAsync<QuoteDetailDto>(JsonOpts))!;

        var close = await client.PostAsync($"/api/quotes/{quote.Id}/close", content: null);
        close.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Close_AfterSupplierDeclined_Succeeds()
    {
        // Decline is a form of engagement: the supplier saw the request and said no.
        // The requester should be able to close the quote once that has happened,
        // even if no supplier has priced.
        var (requester, _) = await NewAuthedClientAsync($"r-dc-{Guid.NewGuid():N}"[..18]);
        var projectId = await CreateProjectWithPlacedItemAsync(requester, "Decline-then-close", "sofa");
        var quote = (await (await requester.PostAsJsonAsync(
            $"/api/projects/{projectId}/quotes", new CreateQuoteRequest(null)))
            .Content.ReadFromJsonAsync<QuoteDetailDto>(JsonOpts))!;

        // Bind a supplier user so they can decline.
        var (supplier, supplierAuth) = await NewAuthedClientAsync($"s-dc-{Guid.NewGuid():N}"[..18]);
        var dizajnoId = await GetDizajnoSupplierIdAsync();
        var adminClient = NewClient();
        adminClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer", await LoginAsAdminAsync(adminClient));
        await adminClient.PostAsJsonAsync("/api/admin/supplier-members",
            new CreateSupplierMemberRequest(dizajnoId, supplierAuth.User.Id, SupplierMemberRole.Owner));

        var decline = await supplier.PostAsJsonAsync(
            $"/api/supplier/quotes/{quote.Requests[0].Id}/decline",
            new SupplierDeclineRequest("Out of stock"));
        decline.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var close = await requester.PostAsync($"/api/quotes/{quote.Id}/close", content: null);
        close.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var refreshed = await requester.GetFromJsonAsync<QuoteDetailDto>(
            $"/api/quotes/{quote.Id}", JsonOpts);
        refreshed!.Status.Should().Be(QuoteStatus.Closed);
    }

    [Fact]
    public async Task IsCustomSize_FlipsTrueWhenScaledDifferFromStock()
    {
        var (client, _) = await NewAuthedClientAsync($"size-{Guid.NewGuid():N}"[..18]);
        // Stock sofa is 2.0 x 0.9 x 0.8 — shrink width to 1.0.
        var projectId = await CreateProjectWithPlacedItemAsync(
            client, "Shrunk", "sofa", scaleW: 1.0m);

        var quote = (await (await client.PostAsJsonAsync(
            $"/api/projects/{projectId}/quotes", new CreateQuoteRequest(null)))
            .Content.ReadFromJsonAsync<QuoteDetailDto>(JsonOpts))!;
        quote.Requests[0].Lines[0].IsCustomSize.Should().BeTrue();
    }

    [Fact]
    public async Task SupplierInbox_NonMember_Returns403()
    {
        var (client, _) = await NewAuthedClientAsync($"nm-{Guid.NewGuid():N}"[..18]);
        var response = await client.GetAsync("/api/supplier/quotes");
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task SupplierFlow_MemberSeesInboxAndCanRespond()
    {
        // Requester sets up a quote.
        var (requester, _) = await NewAuthedClientAsync($"r-{Guid.NewGuid():N}"[..18]);
        var projectId = await CreateProjectWithPlacedItemAsync(requester, "Flow", "sofa");
        var quote = (await (await requester.PostAsJsonAsync(
            $"/api/projects/{projectId}/quotes",
            new CreateQuoteRequest("Please price."))).Content
            .ReadFromJsonAsync<QuoteDetailDto>(JsonOpts))!;
        var requestId = quote.Requests[0].Id;

        // Supplier user is created + bound to the dizajno supplier by an admin.
        var (supplier, supplierAuth) = await NewAuthedClientAsync($"s-{Guid.NewGuid():N}"[..18]);
        var dizajnoId = await GetDizajnoSupplierIdAsync();
        var adminClient = NewClient();
        var adminToken = await LoginAsAdminAsync(adminClient);
        adminClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        var bind = await adminClient.PostAsJsonAsync("/api/admin/supplier-members",
            new CreateSupplierMemberRequest(dizajnoId, supplierAuth.User.Id, SupplierMemberRole.Owner));
        bind.StatusCode.Should().BeOneOf(HttpStatusCode.Created, HttpStatusCode.OK);

        // The supplier's own UserSummary should now expose the membership (and the
        // /supplier/quotes endpoint should let them in).
        var me = await supplier.GetFromJsonAsync<UserSummary>("/api/auth/me", JsonOpts);
        me!.SupplierMemberships.Should().ContainSingle(m => m.SupplierSlug == "dizajno");

        var inbox = await supplier.GetFromJsonAsync<List<SupplierQuoteRequestSummaryDto>>(
            "/api/supplier/quotes", JsonOpts);
        // The inbox is shared across all dizajno-supplier quote requests in the
        // test container; only assert our own quote is visible.
        inbox.Should().Contain(r => r.Id == requestId);

        // Happy-path response.
        var respond = await supplier.PostAsJsonAsync($"/api/supplier/quotes/{requestId}/respond",
            new SupplierRespondRequest(
                TotalPrice: 1499.50m,
                Currency: "EUR",
                Body: "Lead time ~3 weeks.",
                AttachmentAssetIds: null));
        respond.StatusCode.Should().Be(HttpStatusCode.OK);

        // Upsert: a second POST updates the existing row, not a duplicate insert.
        var update = await supplier.PostAsJsonAsync($"/api/supplier/quotes/{requestId}/respond",
            new SupplierRespondRequest(
                TotalPrice: 1399m,
                Currency: "EUR",
                Body: "Revised price.",
                AttachmentAssetIds: null));
        update.StatusCode.Should().Be(HttpStatusCode.OK);

        var refreshed = await requester.GetFromJsonAsync<QuoteDetailDto>(
            $"/api/quotes/{quote.Id}", JsonOpts);
        refreshed!.Requests[0].Status.Should().Be(QuoteRequestStatus.Responded);
        refreshed.Requests[0].Response!.TotalPrice.Should().Be(1399m);
        refreshed.Requests[0].Response!.Body.Should().Be("Revised price.");
    }

    [Fact]
    public async Task SupplierResponse_ForeignSupplierAsset_Returns400()
    {
        // Requester sets up a quote.
        var (requester, _) = await NewAuthedClientAsync($"r-att-{Guid.NewGuid():N}"[..18]);
        var projectId = await CreateProjectWithPlacedItemAsync(requester, "Att", "sofa");
        var quote = (await (await requester.PostAsJsonAsync(
            $"/api/projects/{projectId}/quotes", new CreateQuoteRequest(null)))
            .Content.ReadFromJsonAsync<QuoteDetailDto>(JsonOpts))!;
        var requestId = quote.Requests[0].Id;

        // Bind the supplier user.
        var (supplier, supplierAuth) = await NewAuthedClientAsync($"s-att-{Guid.NewGuid():N}"[..18]);
        var dizajnoId = await GetDizajnoSupplierIdAsync();
        var adminClient = NewClient();
        adminClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer", await LoginAsAdminAsync(adminClient));
        var bind = await adminClient.PostAsJsonAsync("/api/admin/supplier-members",
            new CreateSupplierMemberRequest(dizajnoId, supplierAuth.User.Id, SupplierMemberRole.Owner));
        bind.EnsureSuccessStatusCode();

        // Create an Asset owned by an unrelated supplier and try to use it as attachment.
        Guid foreignAssetId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<DizajnoDbContext>();
            var foreignSupplier = new Supplier
            {
                Id = Guid.NewGuid(),
                Slug = $"foreign-{Guid.NewGuid():N}"[..18],
                Name = "Foreign"
            };
            var asset = new Asset
            {
                Id = Guid.NewGuid(),
                OwnerSupplierId = foreignSupplier.Id,
                Kind = AssetKind.Doc,
                Url = "https://assets.test.local/foreign.pdf",
                MimeType = "application/pdf",
                SizeBytes = 1024
            };
            db.Suppliers.Add(foreignSupplier);
            db.Assets.Add(asset);
            await db.SaveChangesAsync();
            foreignAssetId = asset.Id;
        }

        var response = await supplier.PostAsJsonAsync($"/api/supplier/quotes/{requestId}/respond",
            new SupplierRespondRequest(
                TotalPrice: 1000m,
                Currency: "EUR",
                Body: null,
                AttachmentAssetIds: new[] { foreignAssetId }));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task SupplierResponse_AfterCancel_Returns409()
    {
        var (requester, _) = await NewAuthedClientAsync($"r-cx-{Guid.NewGuid():N}"[..18]);
        var projectId = await CreateProjectWithPlacedItemAsync(requester, "Cx", "sofa");
        var quote = (await (await requester.PostAsJsonAsync(
            $"/api/projects/{projectId}/quotes", new CreateQuoteRequest(null)))
            .Content.ReadFromJsonAsync<QuoteDetailDto>(JsonOpts))!;

        var (supplier, supplierAuth) = await NewAuthedClientAsync($"s-cx-{Guid.NewGuid():N}"[..18]);
        var dizajnoId = await GetDizajnoSupplierIdAsync();
        var adminClient = NewClient();
        adminClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer", await LoginAsAdminAsync(adminClient));
        await adminClient.PostAsJsonAsync("/api/admin/supplier-members",
            new CreateSupplierMemberRequest(dizajnoId, supplierAuth.User.Id, SupplierMemberRole.Owner));

        var cancel = await requester.PostAsync($"/api/quotes/{quote.Id}/cancel", content: null);
        cancel.EnsureSuccessStatusCode();

        var respond = await supplier.PostAsJsonAsync(
            $"/api/supplier/quotes/{quote.Requests[0].Id}/respond",
            new SupplierRespondRequest(100m, "EUR", null, null));
        respond.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task AdminBind_NonAdmin_Returns403()
    {
        var (client, auth) = await NewAuthedClientAsync($"nb-{Guid.NewGuid():N}"[..18]);
        var dizajnoId = await GetDizajnoSupplierIdAsync();

        var response = await client.PostAsJsonAsync("/api/admin/supplier-members",
            new CreateSupplierMemberRequest(dizajnoId, auth.User.Id, SupplierMemberRole.Owner));

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
