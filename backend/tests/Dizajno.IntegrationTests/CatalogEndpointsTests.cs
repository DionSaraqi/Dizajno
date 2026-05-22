using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Dizajno.Api.Contracts;
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
    public async Task GetProducts_ReturnsAllTwelveSeededItems()
    {
        var products = await _client.GetFromJsonAsync<List<FurnitureItemDto>>(
            "/api/catalog/products", JsonOpts);

        products.Should().NotBeNull();
        products!.Should().HaveCount(12);
        products!.Select(p => p.Type).Should().Contain(["bed", "sofa", "armchair", "colorable-sectional-sofa"]);
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

        products!.Should().HaveCount(12);
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
    public async Task GetCategories_ReturnsFourFurnitureCategories()
    {
        var categories = await _client.GetFromJsonAsync<List<CategoryDto>>(
            "/api/catalog/categories", JsonOpts);

        categories!.Should().HaveCount(4);
        categories!.Select(c => c.Name).Should().BeEquivalentTo(
            new[] { "Bedroom", "Seating", "Storage", "Tables" });
        categories!.Should().OnlyContain(c => c.Family == "Furniture");
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
