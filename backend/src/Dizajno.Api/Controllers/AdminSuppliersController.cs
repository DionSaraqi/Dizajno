using Dizajno.Application.Interfaces;
using Dizajno.Domain.Entities;
using Dizajno.Dto.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Api.Controllers;

/// <summary>
/// Phase 7a admin endpoints for the supplier directory. Lets admins create
/// suppliers, edit their public profile, and flip the two operational toggles
/// (<see cref="Supplier.IsTrusted"/> and <see cref="Supplier.SuspendedAt"/>).
/// Suspending a supplier also auto-expires every still-Pending QuoteRequest
/// they have outstanding so requesters don't sit waiting on a dead supplier.
/// </summary>
[ApiController]
[Route("api/admin/suppliers")]
[Authorize(Roles = "Admin")]
public sealed class AdminSuppliersController : ControllerBase
{
    private readonly IAdminSupplierService _service;

    public AdminSuppliersController(IAdminSupplierService service) => _service = service;

    [HttpGet]
    public Task<ActionResult<IReadOnlyList<AdminSupplierDto>>> List(
        CancellationToken cancellationToken,
        [FromQuery] string? search = null,
        [FromQuery] bool? suspended = null,
        [FromQuery] bool? trusted = null)
        => _service.ListAsync(search, suspended, trusted, cancellationToken);

    [HttpGet("{id:guid}")]
    public Task<ActionResult<AdminSupplierDto>> Get(Guid id, CancellationToken cancellationToken)
        => _service.GetAsync(id, cancellationToken);

    [HttpPost]
    public Task<ActionResult<AdminSupplierDto>> Create(
        CreateSupplierRequest request, CancellationToken cancellationToken)
        => _service.CreateAsync(request, cancellationToken);

    [HttpPut("{id:guid}")]
    public Task<ActionResult<AdminSupplierDto>> Update(
        Guid id, UpdateSupplierRequest request, CancellationToken cancellationToken)
        => _service.UpdateAsync(id, request, cancellationToken);

    [HttpPost("{id:guid}/suspend")]
    public Task<ActionResult> Suspend(Guid id, CancellationToken cancellationToken)
        => _service.SuspendAsync(id, cancellationToken);

    [HttpPost("{id:guid}/restore")]
    public Task<ActionResult> Restore(Guid id, CancellationToken cancellationToken)
        => _service.RestoreAsync(id, cancellationToken);

    [HttpPost("{id:guid}/trust")]
    public Task<ActionResult> Trust(Guid id, CancellationToken cancellationToken)
        => _service.TrustAsync(id, cancellationToken);

    [HttpPost("{id:guid}/untrust")]
    public Task<ActionResult> Untrust(Guid id, CancellationToken cancellationToken)
        => _service.UntrustAsync(id, cancellationToken);
}
