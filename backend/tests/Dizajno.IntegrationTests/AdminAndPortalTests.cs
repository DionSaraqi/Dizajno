using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Dizajno.Dto.Admin;
using Dizajno.Dto.Asset;
using Dizajno.Dto.Auth;
using Dizajno.Dto.Catalog;
using Dizajno.Dto.Project;
using Dizajno.Dto.Quote;
using Dizajno.Dto.Share;
using Dizajno.Dto.Supplier;
using Dizajno.Domain.Entities;
using Dizajno.Domain.Enums;
using Dizajno.Data;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Dizajno.IntegrationTests;

/// <summary>
/// Phase 7a â€” admin tooling + invite flow. Covers supplier suspend/trust
/// toggles + their side-effects, invite create/preview/accept + idempotency,
/// product/category moderation queues, and audit-log search.
/// </summary>
public sealed class AdminAndPortalTests : IClassFixture<DizajnoApiFactory>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web)
    {
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() }
    };

    private readonly DizajnoApiFactory _factory;

    public AdminAndPortalTests(DizajnoApiFactory factory) => _factory = factory;

    private HttpClient NewClient() => _factory.CreateClient();

    private async Task<HttpClient> NewAdminClientAsync()
    {
        var client = NewClient();
        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(
            Email: "admin@test.local", Password: "Admin1234!"));
        response.EnsureSuccessStatusCode();
        var auth = (await response.Content.ReadFromJsonAsync<AuthResponse>(JsonOpts))!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return client;
    }

    private async Task<(HttpClient client, AuthResponse auth)> NewUserClientAsync(string suffix)
    {
        var client = NewClient();
        var response = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(
            Email: $"phase7a-{suffix}@dizajno.test",
            Password: "Passw0rd!",
            DisplayName: $"User {suffix}",
            Locale: "sq"));
        response.EnsureSuccessStatusCode();
        var auth = (await response.Content.ReadFromJsonAsync<AuthResponse>(JsonOpts))!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        return (client, auth);
    }

    private async Task<Guid> SeedSupplierAsync(string slug, string name, bool trusted = false)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DizajnoDbContext>();
        var existing = await db.Suppliers.FirstOrDefaultAsync(s => s.Slug == slug);
        if (existing is not null) return existing.Id;
        var s = new Supplier
        {
            Id = Guid.NewGuid(),
            Slug = slug,
            Name = name,
            IsTrusted = trusted,
            CreatedAt = DateTime.UtcNow
        };
        db.Suppliers.Add(s);
        await db.SaveChangesAsync();
        return s.Id;
    }

    private async Task<Guid> GetDizajnoSupplierIdAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DizajnoDbContext>();
        return await db.Suppliers.Where(s => s.Slug == "dizajno").Select(s => s.Id).SingleAsync();
    }

    // â”€â”€ Suppliers: list + suspend + restore + trust flips â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    [Fact]
    public async Task AdminSuppliers_List_RequiresAdminRole()
    {
        var (client, _) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var response = await client.GetAsync("/api/admin/suppliers");
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task AdminSuppliers_Create_PersistsAndReturnsDto()
    {
        var client = await NewAdminClientAsync();
        var slug = $"create-{Guid.NewGuid():N}"[..18].ToLowerInvariant();
        var response = await client.PostAsJsonAsync("/api/admin/suppliers", new CreateSupplierRequest(
            Slug: slug, Name: "Created Co.", Description: "test",
            WebsiteUrl: null, ContactEmail: null, ContactPhone: null));
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var dto = (await response.Content.ReadFromJsonAsync<AdminSupplierDto>(JsonOpts))!;
        dto.Slug.Should().Be(slug);
        dto.IsTrusted.Should().BeFalse();
        dto.SuspendedAt.Should().BeNull();
    }

    [Fact]
    public async Task AdminSuppliers_Create_DuplicateSlug_Returns409()
    {
        var client = await NewAdminClientAsync();
        var slug = $"dup-{Guid.NewGuid():N}"[..15].ToLowerInvariant();
        var first = await client.PostAsJsonAsync("/api/admin/suppliers", new CreateSupplierRequest(
            slug, "First", null, null, null, null));
        first.EnsureSuccessStatusCode();
        var second = await client.PostAsJsonAsync("/api/admin/suppliers", new CreateSupplierRequest(
            slug, "Second", null, null, null, null));
        second.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Suspend_HidesSupplierProductsFromPublicCatalog()
    {
        var anon = NewClient();
        var before = await anon.GetFromJsonAsync<List<FurnitureItemDto>>(
            "/api/catalog/products", JsonOpts);
        before!.Should().NotBeEmpty();
        // We only assert on dizajno-owned rows so this test stays correct even
        // when other tests in the class leave their own Published products
        // behind (e.g. the moderation approve test).
        var dizajnoId = await GetDizajnoSupplierIdAsync();
        var dizajnoBefore = before!.Count(p => p.SupplierId == dizajnoId);
        dizajnoBefore.Should().BeGreaterThan(0);

        var admin = await NewAdminClientAsync();
        try
        {
            var suspend = await admin.PostAsync($"/api/admin/suppliers/{dizajnoId}/suspend", null);
            suspend.StatusCode.Should().Be(HttpStatusCode.NoContent);

            var during = await anon.GetFromJsonAsync<List<FurnitureItemDto>>(
                "/api/catalog/products", JsonOpts);
            during!.Should().NotContain(p => p.SupplierId == dizajnoId);
        }
        finally
        {
            // Always restore so other tests in this class still see the catalog.
            await admin.PostAsync($"/api/admin/suppliers/{dizajnoId}/restore", null);
        }

        var after = await anon.GetFromJsonAsync<List<FurnitureItemDto>>(
            "/api/catalog/products", JsonOpts);
        after!.Count(p => p.SupplierId == dizajnoId).Should().Be(dizajnoBefore);
    }

    [Fact]
    public async Task Trust_AndUntrust_FlipSupplierFlag()
    {
        var supplierId = await SeedSupplierAsync($"trust-{Guid.NewGuid():N}"[..16], "Trust Test Co.");
        var admin = await NewAdminClientAsync();
        (await admin.PostAsync($"/api/admin/suppliers/{supplierId}/trust", null))
            .StatusCode.Should().Be(HttpStatusCode.NoContent);

        var detail = await admin.GetFromJsonAsync<AdminSupplierDto>($"/api/admin/suppliers/{supplierId}", JsonOpts);
        detail!.IsTrusted.Should().BeTrue();

        (await admin.PostAsync($"/api/admin/suppliers/{supplierId}/untrust", null))
            .StatusCode.Should().Be(HttpStatusCode.NoContent);

        detail = await admin.GetFromJsonAsync<AdminSupplierDto>($"/api/admin/suppliers/{supplierId}", JsonOpts);
        detail!.IsTrusted.Should().BeFalse();
    }

    [Fact]
    public async Task Suspend_AutoExpiresPendingQuoteRequests()
    {
        var supplierId = await SeedSupplierAsync($"susp-{Guid.NewGuid():N}"[..14], "Suspend Pending Co.");

        // Drop a Pending QuoteRequest in directly â€” building a real fan-out
        // would need a placed item for this supplier and skips the point.
        Guid requestId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<DizajnoDbContext>();
            var (_, auth) = await NewUserClientAsync($"requester-{Guid.NewGuid():N}"[..12]);
            var quote = new Quote
            {
                Id = Guid.NewGuid(),
                ProjectId = Guid.NewGuid(), // dangling FK is fine â€” no FK enforcement in this slice
                RequesterUserId = auth.User.Id,
                Status = QuoteStatus.Open,
                CreatedAt = DateTime.UtcNow
            };
            db.Projects.Add(new Project
            {
                Id = quote.ProjectId,
                OwnerUserId = auth.User.Id,
                Name = "Phantom",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            db.Quotes.Add(quote);
            var req = new QuoteRequest
            {
                Id = Guid.NewGuid(),
                QuoteId = quote.Id,
                SupplierId = supplierId,
                Status = QuoteRequestStatus.Pending,
                CreatedAt = DateTime.UtcNow
            };
            db.QuoteRequests.Add(req);
            await db.SaveChangesAsync();
            requestId = req.Id;
        }

        var admin = await NewAdminClientAsync();
        var suspend = await admin.PostAsync($"/api/admin/suppliers/{supplierId}/suspend", null);
        suspend.StatusCode.Should().Be(HttpStatusCode.NoContent);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<DizajnoDbContext>();
            var req = await db.QuoteRequests.FirstAsync(r => r.Id == requestId);
            req.Status.Should().Be(QuoteRequestStatus.Expired);
            req.CancellationReason.Should().Be("supplier_suspended");
        }
    }

    [Fact]
    public async Task Suspend_BlocksMemberFromSupplierPortal()
    {
        var supplierId = await SeedSupplierAsync($"block-{Guid.NewGuid():N}"[..15], "Blocked Portal Co.");
        var (client, auth) = await NewUserClientAsync($"member-{Guid.NewGuid():N}"[..10]);

        var admin = await NewAdminClientAsync();
        var bind = await admin.PostAsJsonAsync("/api/admin/supplier-members",
            new CreateSupplierMemberRequest(supplierId, auth.User.Id, SupplierMemberRole.Owner));
        bind.EnsureSuccessStatusCode();

        // Before suspend, supplier list is reachable (200 even if empty).
        var ok = await client.GetAsync("/api/supplier/quotes");
        ok.StatusCode.Should().Be(HttpStatusCode.OK);

        var suspend = await admin.PostAsync($"/api/admin/suppliers/{supplierId}/suspend", null);
        suspend.EnsureSuccessStatusCode();

        // The only membership is suspended now â†’ endpoint forbids.
        var forbidden = await client.GetAsync("/api/supplier/quotes");
        forbidden.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // â”€â”€ Invites â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    [Fact]
    public async Task Invite_Create_ReturnsTokenOnceAndAcceptUrl()
    {
        var supplierId = await SeedSupplierAsync($"inv-{Guid.NewGuid():N}"[..14], "Invite Co.");
        var admin = await NewAdminClientAsync();
        var response = await admin.PostAsJsonAsync("/api/admin/invites", new CreateSupplierInviteRequest(
            supplierId, "newowner@example.com", SupplierMemberRole.Owner, ExpiresInDays: 7));
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var dto = (await response.Content.ReadFromJsonAsync<SupplierInviteDto>(JsonOpts))!;
        dto.Token.Should().NotBeNullOrWhiteSpace();
        dto.AcceptUrl.Should().Contain(dto.Token!);

        // List returns the row but never the token plaintext.
        var list = await admin.GetFromJsonAsync<List<SupplierInviteDto>>(
            $"/api/admin/invites?supplierId={supplierId}", JsonOpts);
        list!.Should().HaveCount(1);
        list![0].Token.Should().BeNull();
    }

    [Fact]
    public async Task Invite_Preview_ReturnsPublicMetadata()
    {
        var supplierId = await SeedSupplierAsync($"prev-{Guid.NewGuid():N}"[..15], "Preview Co.");
        var admin = await NewAdminClientAsync();
        var create = await admin.PostAsJsonAsync("/api/admin/invites", new CreateSupplierInviteRequest(
            supplierId, "preview@example.com", SupplierMemberRole.Staff, null));
        var invite = (await create.Content.ReadFromJsonAsync<SupplierInviteDto>(JsonOpts))!;

        var anon = NewClient();
        var preview = (await anon.GetFromJsonAsync<InvitePreviewDto>(
            $"/api/invites/{invite.Token}", JsonOpts))!;
        preview.SupplierName.Should().Be("Preview Co.");
        preview.Role.Should().Be(SupplierMemberRole.Staff);
        preview.IsAccepted.Should().BeFalse();
        preview.IsExpired.Should().BeFalse();
    }

    [Fact]
    public async Task Invite_Accept_BindsCallerAndIsIdempotent()
    {
        var supplierId = await SeedSupplierAsync($"acc-{Guid.NewGuid():N}"[..14], "Accept Co.");
        var admin = await NewAdminClientAsync();
        var create = await admin.PostAsJsonAsync("/api/admin/invites", new CreateSupplierInviteRequest(
            supplierId, "accept@example.com", SupplierMemberRole.Owner, null));
        var invite = (await create.Content.ReadFromJsonAsync<SupplierInviteDto>(JsonOpts))!;

        var (client, auth) = await NewUserClientAsync($"accepter-{Guid.NewGuid():N}"[..10]);
        var first = await client.PostAsync($"/api/invites/{invite.Token}/accept", null);
        first.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Second accept by the same user is a no-op (NoContent).
        var second = await client.PostAsync($"/api/invites/{invite.Token}/accept", null);
        second.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Membership row is present and has Owner role.
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DizajnoDbContext>();
        var member = await db.SupplierMembers.SingleAsync(m =>
            m.SupplierId == supplierId && m.UserId == auth.User.Id);
        member.Role.Should().Be(SupplierMemberRole.Owner);
    }

    [Fact]
    public async Task Invite_Accept_ByDifferentUser_AfterAlreadyAccepted_Returns409()
    {
        var supplierId = await SeedSupplierAsync($"conf-{Guid.NewGuid():N}"[..14], "Conflict Co.");
        var admin = await NewAdminClientAsync();
        var create = await admin.PostAsJsonAsync("/api/admin/invites", new CreateSupplierInviteRequest(
            supplierId, "conflict@example.com", SupplierMemberRole.Staff, null));
        var invite = (await create.Content.ReadFromJsonAsync<SupplierInviteDto>(JsonOpts))!;

        var (firstClient, _) = await NewUserClientAsync($"first-{Guid.NewGuid():N}"[..10]);
        (await firstClient.PostAsync($"/api/invites/{invite.Token}/accept", null))
            .EnsureSuccessStatusCode();

        var (secondClient, _) = await NewUserClientAsync($"second-{Guid.NewGuid():N}"[..10]);
        var conflict = await secondClient.PostAsync($"/api/invites/{invite.Token}/accept", null);
        conflict.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Invite_Accept_Revoked_Returns410()
    {
        var supplierId = await SeedSupplierAsync($"rev-{Guid.NewGuid():N}"[..14], "Revoke Co.");
        var admin = await NewAdminClientAsync();
        var create = await admin.PostAsJsonAsync("/api/admin/invites", new CreateSupplierInviteRequest(
            supplierId, "revoke@example.com", SupplierMemberRole.Staff, null));
        var invite = (await create.Content.ReadFromJsonAsync<SupplierInviteDto>(JsonOpts))!;

        var revoke = await admin.DeleteAsync($"/api/admin/invites/{invite.Id}");
        revoke.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var (client, _) = await NewUserClientAsync($"victim-{Guid.NewGuid():N}"[..10]);
        var blocked = await client.PostAsync($"/api/invites/{invite.Token}/accept", null);
        blocked.StatusCode.Should().Be(HttpStatusCode.Gone);
    }

    // â”€â”€ Moderation: products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private async Task<(Guid productId, Guid supplierId, Guid categoryId)> CreatePendingProductAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DizajnoDbContext>();
        var supplier = new Supplier
        {
            Id = Guid.NewGuid(),
            Slug = $"pending-{Guid.NewGuid():N}"[..20],
            Name = "Pending Supplier",
            IsTrusted = false,
            CreatedAt = DateTime.UtcNow
        };
        db.Suppliers.Add(supplier);
        var category = await db.Categories
            .Where(c => c.Family == ProductFamily.Furniture && c.Status == CategoryStatus.Approved)
            .FirstAsync();
        var product = new Product
        {
            Id = Guid.NewGuid(),
            SupplierId = supplier.Id,
            Family = ProductFamily.Furniture,
            CategoryId = category.Id,
            Slug = $"pending-prod-{Guid.NewGuid():N}"[..30],
            Status = ProductStatus.Pending,
            UnitOfSale = UnitOfSale.Piece,
            Name = "Pending Product",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        db.Products.Add(product);
        // Real supplier-portal products always have â‰¥1 variant (a variant is
        // the SKU). Without one the catalog projection's First() on Variants
        // throws when the product later gets approved â†’ Published.
        db.ProductVariants.Add(new ProductVariant
        {
            Id = Guid.NewGuid(),
            ProductId = product.Id,
            Sku = $"pend-{Guid.NewGuid():N}"[..16].ToUpperInvariant(),
            Name = product.Name,
            Width = 1m, Depth = 1m, Height = 1m,
            Color = "#999999",
            BasePrice = 100m,
            Currency = "EUR",
            SortOrder = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        return (product.Id, supplier.Id, category.Id);
    }

    [Fact]
    public async Task Moderation_PendingProducts_AppearsInQueue_AndApprovePublishes()
    {
        var (productId, _, _) = await CreatePendingProductAsync();
        var admin = await NewAdminClientAsync();

        var queue = await admin.GetFromJsonAsync<List<PendingProductDto>>(
            "/api/admin/moderation/products", JsonOpts);
        queue!.Should().Contain(p => p.Id == productId);

        var approve = await admin.PostAsync($"/api/admin/moderation/products/{productId}/approve", null);
        approve.StatusCode.Should().Be(HttpStatusCode.NoContent);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DizajnoDbContext>();
        var product = await db.Products.FirstAsync(p => p.Id == productId);
        product.Status.Should().Be(ProductStatus.Published);
    }

    [Fact]
    public async Task Moderation_RejectProduct_FlipsToHidden()
    {
        var (productId, _, _) = await CreatePendingProductAsync();
        var admin = await NewAdminClientAsync();
        var reject = await admin.PostAsync($"/api/admin/moderation/products/{productId}/reject", null);
        reject.StatusCode.Should().Be(HttpStatusCode.NoContent);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DizajnoDbContext>();
        var product = await db.Products.FirstAsync(p => p.Id == productId);
        product.Status.Should().Be(ProductStatus.Hidden);
    }

    [Fact]
    public async Task Moderation_ApproveNonPendingProduct_Returns409()
    {
        // Already-published product: take the first seeded furniture row.
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DizajnoDbContext>();
        var publishedId = await db.Products
            .Where(p => p.Status == ProductStatus.Published)
            .Select(p => p.Id).FirstAsync();

        var admin = await NewAdminClientAsync();
        var response = await admin.PostAsync($"/api/admin/moderation/products/{publishedId}/approve", null);
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    // â”€â”€ Moderation: categories â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    [Fact]
    public async Task Moderation_PendingCategory_ApproveFlipsToApproved()
    {
        var supplierId = await SeedSupplierAsync($"cat-sup-{Guid.NewGuid():N}"[..18], "Cat Supplier");
        Guid categoryId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<DizajnoDbContext>();
            var c = new Category
            {
                Id = Guid.NewGuid(),
                Family = ProductFamily.Lighting,
                Slug = $"pending-cat-{Guid.NewGuid():N}"[..24],
                Name = "Pending Cat",
                Path = "/lighting/pending-cat/",
                Status = CategoryStatus.Pending,
                SuggestedBySupplierId = supplierId
            };
            db.Categories.Add(c);
            await db.SaveChangesAsync();
            categoryId = c.Id;
        }

        var admin = await NewAdminClientAsync();
        var queue = await admin.GetFromJsonAsync<List<PendingCategoryDto>>(
            "/api/admin/moderation/categories", JsonOpts);
        queue!.Should().Contain(c => c.Id == categoryId && c.SuggestedBySupplierName == "Cat Supplier");

        var approve = await admin.PostAsync($"/api/admin/moderation/categories/{categoryId}/approve", null);
        approve.StatusCode.Should().Be(HttpStatusCode.NoContent);

        using var verifyScope = _factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<DizajnoDbContext>();
        var cat = await verifyDb.Categories.FirstAsync(c => c.Id == categoryId);
        cat.Status.Should().Be(CategoryStatus.Approved);
    }

    [Fact]
    public async Task Moderation_RejectPendingCategoryWithProducts_Returns409()
    {
        var supplierId = await SeedSupplierAsync($"cat-prod-{Guid.NewGuid():N}"[..18], "Cat Prod Supplier");
        Guid categoryId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<DizajnoDbContext>();
            var c = new Category
            {
                Id = Guid.NewGuid(),
                Family = ProductFamily.Furniture,
                Slug = $"prod-attached-{Guid.NewGuid():N}"[..24],
                Name = "Prod Attached",
                Path = "/furniture/prod-attached/",
                Status = CategoryStatus.Pending,
                SuggestedBySupplierId = supplierId
            };
            db.Categories.Add(c);
            db.Products.Add(new Product
            {
                Id = Guid.NewGuid(),
                SupplierId = supplierId,
                Family = ProductFamily.Furniture,
                CategoryId = c.Id,
                Slug = $"orphan-{Guid.NewGuid():N}"[..18],
                Status = ProductStatus.Pending,
                UnitOfSale = UnitOfSale.Piece,
                Name = "Orphan Product",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
            categoryId = c.Id;
        }

        var admin = await NewAdminClientAsync();
        var reject = await admin.PostAsync($"/api/admin/moderation/categories/{categoryId}/reject", null);
        reject.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    // â”€â”€ Audit log â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    [Fact]
    public async Task AuditLog_RecordsSupplierLifecycleAndIsSearchable()
    {
        var admin = await NewAdminClientAsync();
        var create = await admin.PostAsJsonAsync("/api/admin/suppliers", new CreateSupplierRequest(
            $"audit-{Guid.NewGuid():N}"[..15], "Audit Co.", null, null, null, null));
        create.EnsureSuccessStatusCode();
        var supplier = (await create.Content.ReadFromJsonAsync<AdminSupplierDto>(JsonOpts))!;

        await admin.PostAsync($"/api/admin/suppliers/{supplier.Id}/trust", null);

        var page = await admin.GetFromJsonAsync<AuditLogPageDto>(
            $"/api/admin/audit-log?entityType=Supplier&entityId={supplier.Id}", JsonOpts);
        page!.Entries.Should().Contain(e => e.Action == "supplier.create");
        page.Entries.Should().Contain(e => e.Action == "supplier.trust");
        page.Entries.Should().OnlyContain(e => e.EntityId == supplier.Id);
    }

    [Fact]
    public async Task AuditLog_RequiresAdminRole()
    {
        var (client, _) = await NewUserClientAsync(Guid.NewGuid().ToString("N")[..8]);
        var response = await client.GetAsync("/api/admin/audit-log");
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // â”€â”€ UserSummary surfaces IsSuspended â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    [Fact]
    public async Task UserSummary_SupplierMemberships_IncludesSuspendedFlag()
    {
        var supplierId = await SeedSupplierAsync($"flag-{Guid.NewGuid():N}"[..15], "Flag Co.");
        var (client, auth) = await NewUserClientAsync($"flagger-{Guid.NewGuid():N}"[..10]);

        var admin = await NewAdminClientAsync();
        await admin.PostAsJsonAsync("/api/admin/supplier-members",
            new CreateSupplierMemberRequest(supplierId, auth.User.Id, SupplierMemberRole.Staff));

        var me = await client.GetFromJsonAsync<UserSummary>("/api/auth/me", JsonOpts);
        me!.SupplierMemberships.Should().ContainSingle(m => m.SupplierId == supplierId && !m.IsSuspended);

        await admin.PostAsync($"/api/admin/suppliers/{supplierId}/suspend", null);
        me = await client.GetFromJsonAsync<UserSummary>("/api/auth/me", JsonOpts);
        me!.SupplierMemberships.Should().ContainSingle(m => m.SupplierId == supplierId && m.IsSuspended);
    }
}
