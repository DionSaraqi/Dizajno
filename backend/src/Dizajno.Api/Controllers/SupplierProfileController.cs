using Dizajno.Application.Interfaces;
using Dizajno.Dto.Supplier;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Api.Controllers;

/// <summary>
/// Phase 7b — Owner-only supplier profile edit. Slug is immutable (URL
/// stability + audit-log entity-id stays useful). IsTrusted + SuspendedAt are
/// admin-only flips and stay outside this endpoint's surface.
/// </summary>
[ApiController]
[Route("api/supplier/profile")]
[Authorize]
public sealed class SupplierProfileController : ControllerBase
{
    private readonly ISupplierProfileService _service;

    public SupplierProfileController(ISupplierProfileService service) => _service = service;

    [HttpGet("{supplierId:guid}")]
    public Task<ActionResult<SupplierProfileDto>> Get(Guid supplierId, CancellationToken cancellationToken)
        => _service.GetAsync(supplierId, User, cancellationToken);

    [HttpPut("{supplierId:guid}")]
    public Task<ActionResult<SupplierProfileDto>> Update(
        Guid supplierId, UpdateProfileRequest request, CancellationToken cancellationToken)
        => _service.UpdateAsync(supplierId, request, User, cancellationToken);
}
