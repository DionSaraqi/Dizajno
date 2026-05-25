using Dizajno.Application.Interfaces;
using Dizajno.Dto.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Api.Controllers;

/// <summary>
/// Admin moderation queues: pending products (every new product from an
/// untrusted supplier) + pending categories (supplier-suggested taxonomy
/// entries). Approve moves the row to the published/approved state; reject
/// hides the product or deletes the category outright.
/// </summary>
[ApiController]
[Route("api/admin/moderation")]
[Authorize(Roles = "Admin")]
public sealed class AdminModerationController : ControllerBase
{
    private readonly IAdminModerationService _service;

    public AdminModerationController(IAdminModerationService service) => _service = service;

    [HttpGet("products")]
    public Task<ActionResult<IReadOnlyList<PendingProductDto>>> ListPendingProducts(
        CancellationToken cancellationToken)
        => _service.ListPendingProductsAsync(cancellationToken);

    [HttpPost("products/{id:guid}/approve")]
    public Task<ActionResult> ApproveProduct(Guid id, CancellationToken cancellationToken)
        => _service.ApproveProductAsync(id, cancellationToken);

    [HttpPost("products/{id:guid}/reject")]
    public Task<ActionResult> RejectProduct(Guid id, CancellationToken cancellationToken)
        => _service.RejectProductAsync(id, cancellationToken);

    [HttpGet("categories")]
    public Task<ActionResult<IReadOnlyList<PendingCategoryDto>>> ListPendingCategories(
        CancellationToken cancellationToken)
        => _service.ListPendingCategoriesAsync(cancellationToken);

    [HttpPost("categories/{id:guid}/approve")]
    public Task<ActionResult> ApproveCategory(Guid id, CancellationToken cancellationToken)
        => _service.ApproveCategoryAsync(id, cancellationToken);

    [HttpPost("categories/{id:guid}/reject")]
    public Task<ActionResult> RejectCategory(Guid id, CancellationToken cancellationToken)
        => _service.RejectCategoryAsync(id, cancellationToken);
}
