using Dizajno.Application.Interfaces;
using Dizajno.Domain.Enums;
using Dizajno.Dto.Quote;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Api.Controllers;

/// <summary>
/// Phase 5 â€” supplier-facing endpoints. Gated by <see cref="ISupplierMembershipResolver"/>:
/// every action validates that the signed-in user is a member of at least one supplier
/// (for list views) or of the specific supplier addressed by the target QuoteRequest.
/// </summary>
[ApiController]
[Route("api/supplier/quotes")]
[Authorize]
public sealed class SupplierQuotesController : ControllerBase
{
    private readonly ISupplierQuoteService _service;

    public SupplierQuotesController(ISupplierQuoteService service) => _service = service;

    [HttpGet]
    public Task<ActionResult<IReadOnlyList<SupplierQuoteRequestSummaryDto>>> List(
        CancellationToken cancellationToken,
        [FromQuery] QuoteRequestStatus? status = null,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50)
        => _service.ListAsync(User, status, skip, take, cancellationToken);

    [HttpGet("{id:guid}")]
    public Task<ActionResult<SupplierQuoteRequestDetailDto>> Get(
        Guid id, CancellationToken cancellationToken)
        => _service.GetAsync(id, User, cancellationToken);

    [HttpPost("{id:guid}/respond")]
    public Task<ActionResult<QuoteResponseDto>> Respond(
        Guid id,
        SupplierRespondRequest request,
        CancellationToken cancellationToken)
        => _service.RespondAsync(id, request, User, cancellationToken);

    [HttpPost("{id:guid}/decline")]
    public Task<ActionResult> Decline(
        Guid id,
        SupplierDeclineRequest request,
        CancellationToken cancellationToken)
        => _service.DeclineAsync(id, request, User, cancellationToken);
}
