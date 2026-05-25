using Dizajno.Application.Interfaces;
using Dizajno.Domain.Enums;
using Dizajno.Dto.Quote;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Api.Controllers;

/// <summary>
/// Phase 5 — user-facing quoting endpoints. Companion controllers:
/// <see cref="SupplierQuotesController"/> (per-supplier inbox + respond),
/// <see cref="AdminSupplierMembersController"/> (Phase-5 stopgap for binding members).
/// </summary>
[ApiController]
[Route("api")]
[Authorize]
public sealed class QuotesController : ControllerBase
{
    private readonly IQuoteService _service;

    public QuotesController(IQuoteService service) => _service = service;

    [HttpPost("projects/{projectId:guid}/quotes")]
    public Task<ActionResult<QuoteDetailDto>> Create(
        Guid projectId,
        CreateQuoteRequest request,
        CancellationToken cancellationToken)
        => _service.CreateAsync(projectId, request, User, cancellationToken);

    [HttpGet("quotes")]
    public Task<ActionResult<IReadOnlyList<QuoteSummaryDto>>> List(
        CancellationToken cancellationToken,
        [FromQuery] QuoteStatus? status = null,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50)
        => _service.ListAsync(User, status, skip, take, cancellationToken);

    [HttpGet("quotes/{id:guid}")]
    public Task<ActionResult<QuoteDetailDto>> Get(
        Guid id, CancellationToken cancellationToken)
        => _service.GetAsync(id, User, cancellationToken);

    [HttpPost("quotes/{id:guid}/cancel")]
    public Task<ActionResult> Cancel(Guid id, CancellationToken cancellationToken)
        => _service.CancelAsync(id, User, cancellationToken);

    [HttpPost("quotes/{id:guid}/close")]
    public Task<ActionResult> Close(Guid id, CancellationToken cancellationToken)
        => _service.CloseAsync(id, User, cancellationToken);
}
