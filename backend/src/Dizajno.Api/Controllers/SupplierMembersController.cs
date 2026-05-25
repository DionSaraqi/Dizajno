using Dizajno.Application.Interfaces;
using Dizajno.Dto.Supplier;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Api.Controllers;

/// <summary>
/// Phase 7b — Owner-only member management. Staff can do everything else in
/// the portal (catalog edits, quote responses) but cannot promote/demote/remove
/// other members or change the supplier profile.
///
/// Last-Owner protection: demoting the last Owner to Staff, or removing the
/// last Owner, fails with 409. The supplier must have at least one Owner at
/// all times. (An admin can still bind a new Owner via the Phase-5 stopgap
/// or issue a fresh invite if the team genuinely wants to roll over.)
/// </summary>
[ApiController]
[Route("api/supplier/members")]
[Authorize]
public sealed class SupplierMembersController : ControllerBase
{
    private readonly ISupplierMemberService _service;

    public SupplierMembersController(ISupplierMemberService service) => _service = service;

    [HttpGet]
    public Task<ActionResult<IReadOnlyList<SupplierMemberSummaryDto>>> List(
        CancellationToken cancellationToken,
        [FromQuery] Guid supplierId)
        => _service.ListAsync(supplierId, User, cancellationToken);

    [HttpPut("{id:guid}/role")]
    public Task<ActionResult> ChangeRole(
        Guid id, ChangeMemberRoleRequest request, CancellationToken cancellationToken)
        => _service.ChangeRoleAsync(id, request, User, cancellationToken);

    [HttpDelete("{id:guid}")]
    public Task<ActionResult> Remove(Guid id, CancellationToken cancellationToken)
        => _service.RemoveAsync(id, User, cancellationToken);
}
