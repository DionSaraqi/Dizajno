using Dizajno.Dto.Catalog;
using Dizajno.Dto.Supplier;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Application.Interfaces;

public interface ICatalogService
{
    Task<ActionResult<IReadOnlyList<FurnitureItemDto>>> GetProductsAsync(
        string? family,
        string? category,
        CancellationToken cancellationToken);

    Task<ActionResult<FurnitureItemDto>> GetProductAsync(
        string slug,
        CancellationToken cancellationToken);

    Task<ActionResult<IReadOnlyList<CategoryDto>>> GetCategoriesAsync(
        string? family,
        CancellationToken cancellationToken);

    Task<ActionResult<IReadOnlyList<SupplierDto>>> GetSuppliersAsync(
        CancellationToken cancellationToken);
}
