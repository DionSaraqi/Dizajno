using Dizajno.Application.Interfaces;
using Dizajno.Dto.Project;
using Dizajno.Dto.Share;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Api.Controllers;

[ApiController]
[Route("api/projects")]
[Authorize]
public sealed class ProjectsController : ControllerBase
{
    private readonly IProjectService _service;

    public ProjectsController(IProjectService service) => _service = service;

    [HttpGet]
    public Task<ActionResult<IReadOnlyList<ProjectSummaryDto>>> List(
        CancellationToken cancellationToken,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50)
        => _service.ListAsync(User, skip, take, cancellationToken);

    [HttpPost]
    public Task<ActionResult<ProjectDetailDto>> Create(
        CreateProjectRequest request,
        CancellationToken cancellationToken)
        => _service.CreateAsync(request, User, cancellationToken);

    [HttpGet("{id:guid}")]
    public Task<ActionResult<ProjectDetailDto>> Get(
        Guid id,
        CancellationToken cancellationToken)
        => _service.GetAsync(id, User, cancellationToken);

    [HttpPut("{id:guid}/scene")]
    public Task<ActionResult<ProjectDetailDto>> ReplaceScene(
        Guid id,
        ReplaceSceneRequest request,
        CancellationToken cancellationToken)
        => _service.ReplaceSceneAsync(id, request, User, cancellationToken);

    [HttpPut("{id:guid}")]
    public Task<ActionResult<ProjectSummaryDto>> Update(
        Guid id,
        UpdateProjectRequest request,
        CancellationToken cancellationToken)
        => _service.UpdateAsync(id, request, User, cancellationToken);

    [HttpPost("{id:guid}/thumbnail/presign")]
    public Task<ActionResult<PresignProjectThumbnailResponse>> PresignThumbnail(
        Guid id,
        PresignProjectThumbnailRequest request,
        CancellationToken cancellationToken)
        => _service.PresignThumbnailAsync(id, request, User, cancellationToken);

    [HttpPut("{id:guid}/thumbnail")]
    public Task<ActionResult<ProjectSummaryDto>> AttachThumbnail(
        Guid id,
        AttachProjectThumbnailRequest request,
        CancellationToken cancellationToken)
        => _service.AttachThumbnailAsync(id, request, User, cancellationToken);

    // â”€â”€ Shares (owner-side) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    [HttpGet("{id:guid}/shares")]
    public Task<ActionResult<IReadOnlyList<ShareSummaryDto>>> ListShares(
        Guid id,
        CancellationToken cancellationToken)
        => _service.ListSharesAsync(id, User, cancellationToken);

    [HttpPost("{id:guid}/shares")]
    public Task<ActionResult<ShareSummaryDto>> CreateShare(
        Guid id,
        CreateShareRequest request,
        CancellationToken cancellationToken)
        => _service.CreateShareAsync(id, request, User, cancellationToken);

    [HttpDelete("{id:guid}/shares/{shareId:guid}")]
    public Task<ActionResult> RevokeShare(
        Guid id,
        Guid shareId,
        CancellationToken cancellationToken)
        => _service.RevokeShareAsync(id, shareId, User, cancellationToken);

    // â”€â”€ Comments (owner inbox) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    [HttpGet("{id:guid}/comments")]
    public Task<ActionResult<IReadOnlyList<CommentDto>>> ListComments(
        Guid id,
        CancellationToken cancellationToken)
        => _service.ListCommentsAsync(id, User, cancellationToken);

    [HttpDelete("{id:guid}")]
    public Task<ActionResult> Delete(Guid id, CancellationToken cancellationToken)
        => _service.DeleteAsync(id, User, cancellationToken);

    [HttpPost("{id:guid}/versions")]
    public Task<ActionResult<ProjectVersionSummaryDto>> CreateVersion(
        Guid id,
        CreateVersionRequest request,
        CancellationToken cancellationToken)
        => _service.CreateVersionAsync(id, request, User, cancellationToken);

    [HttpPost("{id:guid}/versions/{versionId:guid}/restore")]
    public Task<ActionResult<ProjectDetailDto>> RestoreVersion(
        Guid id,
        Guid versionId,
        CancellationToken cancellationToken)
        => _service.RestoreVersionAsync(id, versionId, User, cancellationToken);
}
