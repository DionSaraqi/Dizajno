using Dizajno.Application.Interfaces;
using Dizajno.Domain.Entities;
using Dizajno.Domain.Enums;
using Dizajno.Dto.Supplier;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Api.Controllers;

/// <summary>
/// Phase 7b — supplier-facing product CRUD + status transitions.
///
/// Lifecycle the supplier controls:
/// <list type="bullet">
///   <item><c>Draft</c> ← create. Hidden from public catalog; freely editable.</item>
///   <item><c>Draft → Pending</c> via <c>POST /{id}/publish</c> for untrusted suppliers; admin moderation queue picks it up.</item>
///   <item><c>Draft → Published</c> via the same endpoint for trusted suppliers (<see cref="Supplier.IsTrusted"/>).</item>
///   <item><c>Published → Hidden</c> via <c>POST /{id}/hide</c>. Supplier-initiated unpublish.</item>
///   <item><c>Hidden → Published</c> via <c>POST /{id}/publish</c>. Never re-triggers Pending — already moderated once.</item>
///   <item><c>* → Removed</c> via <c>POST /{id}/remove</c>. Historical <c>QuoteLine.variant_snapshot</c> still protects past quotes.</item>
/// </list>
///
/// Editing a Published product (name/description/etc.) does <em>not</em> re-trigger Pending — by design, decided in Phase 7
/// planning. Future moderation needs (e.g. flagging post-publish edits) would slot in via a separate audit-driven workflow.
/// </summary>
[ApiController]
[Route("api/supplier/products")]
[Authorize]
public sealed class SupplierProductsController : ControllerBase
{
    private readonly ISupplierProductService _service;

    public SupplierProductsController(ISupplierProductService service) => _service = service;

    [HttpGet]
    public Task<ActionResult<IReadOnlyList<SupplierProductSummaryDto>>> List(
        CancellationToken cancellationToken,
        [FromQuery] Guid? supplierId = null,
        [FromQuery] ProductStatus? status = null,
        [FromQuery] string? search = null)
        => _service.ListAsync(User, supplierId, status, search, cancellationToken);

    [HttpGet("{id:guid}")]
    public Task<ActionResult<SupplierProductDetailDto>> Get(Guid id, CancellationToken cancellationToken)
        => _service.GetAsync(id, User, cancellationToken);

    [HttpPost]
    public Task<ActionResult<SupplierProductDetailDto>> Create(
        CreateProductRequest request, CancellationToken cancellationToken)
        => _service.CreateAsync(request, User, cancellationToken);

    [HttpPut("{id:guid}")]
    public Task<ActionResult<SupplierProductDetailDto>> Update(
        Guid id, UpdateProductRequest request, CancellationToken cancellationToken)
        => _service.UpdateAsync(id, request, User, cancellationToken);

    [HttpPost("{id:guid}/publish")]
    public Task<ActionResult> Publish(Guid id, CancellationToken cancellationToken)
        => _service.PublishAsync(id, User, cancellationToken);

    [HttpPost("{id:guid}/hide")]
    public Task<ActionResult> Hide(Guid id, CancellationToken cancellationToken)
        => _service.HideAsync(id, User, cancellationToken);

    [HttpPost("{id:guid}/remove")]
    public Task<ActionResult> Remove(Guid id, CancellationToken cancellationToken)
        => _service.RemoveAsync(id, User, cancellationToken);
}
