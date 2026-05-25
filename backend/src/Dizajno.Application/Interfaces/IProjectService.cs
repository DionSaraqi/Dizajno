using System.Security.Claims;
using Dizajno.Dto.Project;
using Dizajno.Dto.Share;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Application.Interfaces;

public interface IProjectService
{
    Task<ActionResult<IReadOnlyList<ProjectSummaryDto>>> ListAsync(
        ClaimsPrincipal user,
        int skip,
        int take,
        CancellationToken cancellationToken);

    Task<ActionResult<ProjectDetailDto>> CreateAsync(
        CreateProjectRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult<ProjectDetailDto>> GetAsync(
        Guid id,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult<ProjectDetailDto>> ReplaceSceneAsync(
        Guid id,
        ReplaceSceneRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult<ProjectSummaryDto>> UpdateAsync(
        Guid id,
        UpdateProjectRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult<PresignProjectThumbnailResponse>> PresignThumbnailAsync(
        Guid id,
        PresignProjectThumbnailRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult<ProjectSummaryDto>> AttachThumbnailAsync(
        Guid id,
        AttachProjectThumbnailRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult<IReadOnlyList<ShareSummaryDto>>> ListSharesAsync(
        Guid id,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult<ShareSummaryDto>> CreateShareAsync(
        Guid id,
        CreateShareRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult> RevokeShareAsync(
        Guid id,
        Guid shareId,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult<IReadOnlyList<CommentDto>>> ListCommentsAsync(
        Guid id,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult> DeleteAsync(
        Guid id,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult<ProjectVersionSummaryDto>> CreateVersionAsync(
        Guid id,
        CreateVersionRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult<ProjectDetailDto>> RestoreVersionAsync(
        Guid id,
        Guid versionId,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);
}
