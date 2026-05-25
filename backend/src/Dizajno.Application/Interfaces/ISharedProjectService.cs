using System.Security.Claims;
using Dizajno.Dto.Project;
using Dizajno.Dto.Share;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Application.Interfaces;

public interface ISharedProjectService
{
    Task<ActionResult<SharedProjectDto>> LoadAsync(
        string token,
        CancellationToken cancellationToken);

    Task<ActionResult<IReadOnlyList<CommentDto>>> ListCommentsAsync(
        string token,
        CancellationToken cancellationToken);

    Task<ActionResult<CommentDto>> PostCommentAsync(
        string token,
        PostCommentRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);
}
