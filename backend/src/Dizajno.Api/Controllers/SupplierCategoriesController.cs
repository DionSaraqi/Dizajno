using Dizajno.Application.Interfaces;
using Dizajno.Dto.Supplier;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Api.Controllers;

/// <summary>
/// Phase 7b â€” supplier-side category suggestions. Suppliers can propose a new
/// taxonomy entry under one of the five hard-coded ProductFamily values; the
/// row lands in CategoryStatus.Pending with Category.SuggestedBySupplierId
/// populated, and the admin moderation queue (Phase 7a) approves or rejects.
///
/// Suppliers cannot edit or delete suggested categories from here â€” once
/// submitted, admin owns the lifecycle. The supplier just sees the row in
/// their portal until it flips to Approved.
/// </summary>
[ApiController]
[Route("api/supplier/categories")]
[Authorize]
public sealed class SupplierCategoriesController : ControllerBase
{
    private readonly ISupplierCategoryService _service;

    public SupplierCategoriesController(ISupplierCategoryService service) => _service = service;

    [HttpGet]
    public Task<ActionResult<IReadOnlyList<SuggestedCategoryDto>>> List(
        CancellationToken cancellationToken,
        [FromQuery] Guid? supplierId = null)
        => _service.ListAsync(User, supplierId, cancellationToken);

    [HttpPost]
    public Task<ActionResult<SuggestedCategoryDto>> Suggest(
        SuggestCategoryRequest request, CancellationToken cancellationToken)
        => _service.SuggestAsync(request, User, cancellationToken);
}
