using Dizajno.Dto.Admin;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Application.Interfaces;

public interface IAdminSupplierMemberService
{
    Task<ActionResult<IReadOnlyList<SupplierMemberDto>>> ListAsync(
        Guid? supplierId,
        Guid? userId,
        CancellationToken cancellationToken);

    Task<ActionResult<SupplierMemberDto>> CreateAsync(
        CreateSupplierMemberRequest request,
        CancellationToken cancellationToken);

    Task<ActionResult> DeleteAsync(Guid id, CancellationToken cancellationToken);
}
