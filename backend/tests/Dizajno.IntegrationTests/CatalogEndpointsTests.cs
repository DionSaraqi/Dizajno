using System.Net;
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
using FluentAssertions;
using Xunit;

namespace Dizajno.IntegrationTests;

public sealed class CatalogEndpointsTests : IClassFixture<DizajnoApiFactory>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    private readonly HttpClient _client;

    public CatalogEndpointsTests(DizajnoApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetProducts_ReturnsAllSeededItems()
    {
        var products = await _client.GetFromJsonAsync<List<FurnitureItemDto>>(
            "/api/catalog/products", JsonOpts);

        products.Should().NotBeNull();
        // Phase 1 seeded 12 furniture items; Phase 6 added 2 fixtures + 6 building
        // materials (3 paints + 3 floorings, including the budget/premium tiers
        // shipped alongside the original two so the calculator showcases
        // distinct per-unit prices).
        products!.Should().HaveCount(20);
        products!.Select(p => p.Type).Should().Contain([
            "bed", "sofa", "armchair", "colorable-sectional-sofa",
            "solid-oak-door", "pvc-window",
            "interior-matt-paint", "premium-eco-paint", "exterior-weather-paint",
            "oak-laminate-flooring", "budget-vinyl-flooring", "engineered-hardwood"
        ]);
    }

    [Fact]
    public async Task GetProducts_ExposesBasePrices()
    {
        var products = await _client.GetFromJsonAsync<List<FurnitureItemDto>>(
            "/api/catalog/products", JsonOpts);
        products.Should().NotBeNull();
        // Every seeded row now carries a BasePrice so the request-quote
        // dialog can render real per-supplier subtotals and per-material
        // line totals. Regression guard if anyone forgets to wire a new row.
        products!.Should().OnlyContain(p => p.BasePrice != null && p.BasePrice > 0);
        var sofa = products!.Single(p => p.Type == "sofa");
        sofa.BasePrice.Should().Be(499m);
        sofa.Currency.Should().Be("EUR");
    }

    [Theory]
    [InlineData("seating", 6)]
    [InlineData("bedroom", 2)]
    [InlineData("tables", 2)]
    [InlineData("storage", 2)]
    public async Task GetProducts_FiltersByCategory(string category, int expected)
    {
        var products = await _client.GetFromJsonAsync<List<FurnitureItemDto>>(
            $"/api/catalog/products?category={category}", JsonOpts);

        products.Should().HaveCount(expected);
        products.Should().OnlyContain(p =>
            string.Equals(p.Category, category, StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task GetProducts_FiltersByFamily_LightingReturnsEmpty()
    {
        var products = await _client.GetFromJsonAsync<List<FurnitureItemDto>>(
            "/api/catalog/products?family=lighting", JsonOpts);

        products.Should().BeEmpty();
    }

    [Fact]
    public async Task GetProducts_FamilyIsCaseInsensitive()
    {
        var products = await _client.GetFromJsonAsync<List<FurnitureItemDto>>(
            "/api/catalog/products?family=FURNITURE", JsonOpts);

        // Filter narrows to the 12 Phase-1 furniture items; the Phase-6 fixtures and
        // building materials are excluded.
        products!.Should().HaveCount(12);
    }

    [Fact]
    public async Task GetProducts_FiltersByFamily_FixtureReturnsDoorAndWindow()
    {
        var products = await _client.GetFromJsonAsync<List<FurnitureItemDto>>(
            "/api/catalog/products?family=fixture", JsonOpts);

        products!.Should().HaveCount(2);
        products!.Select(p => p.Type).Should().BeEquivalentTo(
            new[] { "solid-oak-door", "pvc-window" });
        products!.Should().OnlyContain(p => p.Family == "Fixture");
    }

    [Fact]
    public async Task GetProducts_FiltersByFamily_BuildingMaterialExposesUnitAndCoverage()
    {
        var products = await _client.GetFromJsonAsync<List<FurnitureItemDto>>(
            "/api/catalog/products?family=buildingmaterial", JsonOpts);

        // 3 paints (interior-matt, premium-eco, exterior-weather) + 3 flooring
        // tiers (oak-laminate, budget-vinyl, engineered-hardwood) â€” distinct
        // per-unit prices so the request-quote calculator has something to chew on.
        products!.Should().HaveCount(6);

        var paint = products!.Single(p => p.Type == "interior-matt-paint");
        paint.Family.Should().Be("BuildingMaterial");
        paint.UnitOfSale.Should().Be("Liter");
        paint.CoverageRate.Should().Be(10m);
        paint.WasteFactor.Should().Be(0.10m);
        paint.BasePrice.Should().Be(4m);

        var premiumPaint = products!.Single(p => p.Type == "premium-eco-paint");
        premiumPaint.CoverageRate.Should().Be(12m);
        premiumPaint.BasePrice.Should().Be(9m);

        var flooring = products!.Single(p => p.Type == "oak-laminate-flooring");
        flooring.UnitOfSale.Should().Be("SquareMeter");
        flooring.WasteFactor.Should().Be(0.05m);
        flooring.CoverageRate.Should().BeNull();
        flooring.BasePrice.Should().Be(18m);

        var hardwood = products!.Single(p => p.Type == "engineered-hardwood");
        hardwood.BasePrice.Should().Be(45m);
    }

    [Fact]
    public async Task GetProductBySlug_ReturnsCompleteItem()
    {
        var product = await _client.GetFromJsonAsync<FurnitureItemDto>(
            "/api/catalog/products/colorable-sectional-sofa", JsonOpts);

        product.Should().NotBeNull();
        product!.Label.Should().Be("Designer Sectional");
        product.Category.Should().Be("Seating");
        product.ModelUrl.Should().Be("/models/colorable-sectional-sofa.glb");
        product.CollisionBoxes.Should().HaveCount(2);
        product.MaterialSlots.Should().NotBeNull()
            .And.ContainKeys("Body", "Legs", "Pillows");
        product.TextureSlots.Should().NotBeNull()
            .And.ContainKey("Body");
        product.SvgPreview.Should().StartWith("<svg");
    }

    [Fact]
    public async Task GetProductBySlug_ReturnsNotFound_WhenSlugUnknown()
    {
        var response = await _client.GetAsync("/api/catalog/products/i-do-not-exist");
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetCategories_FilteredByFurniture_ReturnsFourRows()
    {
        var categories = await _client.GetFromJsonAsync<List<CategoryDto>>(
            "/api/catalog/categories?family=furniture", JsonOpts);

        categories!.Should().HaveCount(4);
        categories!.Select(c => c.Name).Should().BeEquivalentTo(
            new[] { "Bedroom", "Seating", "Storage", "Tables" });
        categories!.Should().OnlyContain(c => c.Family == "Furniture");
    }

    [Fact]
    public async Task GetCategories_Unfiltered_IncludesPhase6Families()
    {
        var categories = await _client.GetFromJsonAsync<List<CategoryDto>>(
            "/api/catalog/categories", JsonOpts);

        // 4 furniture + 2 fixture (Doors/Windows) + 2 building material (Paint/Flooring).
        categories!.Should().HaveCount(8);
        categories!.Select(c => c.Family).Distinct().Should().BeEquivalentTo(
            new[] { "Furniture", "Fixture", "BuildingMaterial" });
    }

    [Fact]
    public async Task GetSuppliers_ReturnsDizajno()
    {
        var suppliers = await _client.GetFromJsonAsync<List<SupplierDto>>(
            "/api/catalog/suppliers", JsonOpts);

        suppliers.Should().ContainSingle(s => s.Slug == "dizajno" && s.Name == "Dizajno");
    }

    [Fact]
    public async Task HealthEndpoint_ReturnsOk()
    {
        var response = await _client.GetAsync("/health");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("\"status\":\"ok\"");
    }
}
