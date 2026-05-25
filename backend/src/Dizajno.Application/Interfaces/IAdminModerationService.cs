using Dizajno.Dto.Admin;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Application.Interfaces;

public interface IAdminModerationService
{
    Task<ActionResult<IReadOnlyList<PendingProductDto>>> ListPendingProductsAsync(
        CancellationToken cancellationToken);

    Task<ActionResult> ApproveProductAsync(Guid id, CancellationToken cancellationToken);

    Task<ActionResult> RejectProductAsync(Guid id, CancellationToken cancellationToken);

    Task<ActionResult<IReadOnlyList<PendingCategoryDto>>> ListPendingCategoriesAsync(
        CancellationToken cancellationToken);

    Task<ActionResult> ApproveCategoryAsync(Guid id, CancellationToken cancellationToken);

    Task<ActionResult> RejectCategoryAsync(Guid id, CancellationToken cancellationToken);
}
