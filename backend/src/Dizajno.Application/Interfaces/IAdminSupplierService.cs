using Dizajno.Dto.Admin;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Application.Interfaces;

public interface IAdminSupplierService
{
    Task<ActionResult<IReadOnlyList<AdminSupplierDto>>> ListAsync(
        string? search,
        bool? suspended,
        bool? trusted,
        CancellationToken cancellationToken);

    Task<ActionResult<AdminSupplierDto>> GetAsync(Guid id, CancellationToken cancellationToken);

    Task<ActionResult<AdminSupplierDto>> CreateAsync(
        CreateSupplierRequest request,
        CancellationToken cancellationToken);

    Task<ActionResult<AdminSupplierDto>> UpdateAsync(
        Guid id,
        UpdateSupplierRequest request,
        CancellationToken cancellationToken);

    Task<ActionResult> SuspendAsync(Guid id, CancellationToken cancellationToken);

    Task<ActionResult> RestoreAsync(Guid id, CancellationToken cancellationToken);

    Task<ActionResult> TrustAsync(Guid id, CancellationToken cancellationToken);

    Task<ActionResult> UntrustAsync(Guid id, CancellationToken cancellationToken);
}
