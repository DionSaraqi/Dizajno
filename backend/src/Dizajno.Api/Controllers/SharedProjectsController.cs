using Dizajno.Application.Interfaces;
using Dizajno.Dto.Share;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Api.Controllers;

/// <summary>
/// Public, token-scoped view of a project: lets anyone with a non-revoked
/// share link load the scene and (in Comment mode) read/post comments. No
/// bearer required, but signed-in users get their identity recorded on any
/// comments they post via the same endpoint.
/// </summary>
[ApiController]
[Route("api/share")]
[AllowAnonymous]
public sealed class SharedProjectsController : ControllerBase
{
    private readonly ISharedProjectService _service;

    public SharedProjectsController(ISharedProjectService service) => _service = service;

    [HttpGet("{token}")]
    public Task<ActionResult<SharedProjectDto>> Load(
        string token,
        CancellationToken cancellationToken)
        => _service.LoadAsync(token, cancellationToken);

    [HttpGet("{token}/comments")]
    public Task<ActionResult<IReadOnlyList<CommentDto>>> ListComments(
        string token,
        CancellationToken cancellationToken)
        => _service.ListCommentsAsync(token, cancellationToken);

    [HttpPost("{token}/comments")]
    public Task<ActionResult<CommentDto>> PostComment(
        string token,
        PostCommentRequest request,
        CancellationToken cancellationToken)
        => _service.PostCommentAsync(token, request, User, cancellationToken);
}
