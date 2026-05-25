using Dizajno.Application.Interfaces;
using Dizajno.Dto.Catalog;
using Dizajno.Dto.Supplier;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Api.Controllers;

[ApiController]
[Route("api/catalog")]
public sealed class CatalogController : ControllerBase
{
    private readonly ICatalogService _service;

    public CatalogController(ICatalogService service) => _service = service;

    [HttpGet("products")]
    public Task<ActionResult<IReadOnlyList<FurnitureItemDto>>> GetProducts(
        CancellationToken cancellationToken,
        [FromQuery] string? family = null,
        [FromQuery] string? category = null)
        => _service.GetProductsAsync(family, category, cancellationToken);

    [HttpGet("products/{slug}")]
    public Task<ActionResult<FurnitureItemDto>> GetProduct(
        string slug,
        CancellationToken cancellationToken)
        => _service.GetProductAsync(slug, cancellationToken);

    [HttpGet("categories")]
    public Task<ActionResult<IReadOnlyList<CategoryDto>>> GetCategories(
        CancellationToken cancellationToken,
        [FromQuery] string? family = null)
        => _service.GetCategoriesAsync(family, cancellationToken);

    [HttpGet("suppliers")]
    public Task<ActionResult<IReadOnlyList<SupplierDto>>> GetSuppliers(
        CancellationToken cancellationToken)
        => _service.GetSuppliersAsync(cancellationToken);
}
