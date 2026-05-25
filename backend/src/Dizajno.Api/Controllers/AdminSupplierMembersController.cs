using Dizajno.Application.Interfaces;
using Dizajno.Dto.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Api.Controllers;

/// <summary>
/// Phase-5 stopgap endpoint that lets admins bind users to suppliers. Real
/// member-management UI ships with the Phase 7 supplier portal; until then
/// this is how integration tests + Swagger smoke wire suppliers up.
/// </summary>
[ApiController]
[Route("api/admin/supplier-members")]
[Authorize(Roles = "Admin")]
public sealed class AdminSupplierMembersController : ControllerBase
{
    private readonly IAdminSupplierMemberService _service;

    public AdminSupplierMembersController(IAdminSupplierMemberService service) => _service = service;

    [HttpGet]
    public Task<ActionResult<IReadOnlyList<SupplierMemberDto>>> List(
        CancellationToken cancellationToken,
        [FromQuery] Guid? supplierId = null,
        [FromQuery] Guid? userId = null)
        => _service.ListAsync(supplierId, userId, cancellationToken);

    [HttpPost]
    public Task<ActionResult<SupplierMemberDto>> Create(
        CreateSupplierMemberRequest request,
        CancellationToken cancellationToken)
        => _service.CreateAsync(request, cancellationToken);

    [HttpDelete("{id:guid}")]
    public Task<ActionResult> Delete(Guid id, CancellationToken cancellationToken)
        => _service.DeleteAsync(id, cancellationToken);
}
