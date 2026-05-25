using System.Security.Claims;
using Dizajno.Domain.Enums;
using Dizajno.Dto.Quote;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Application.Interfaces;

public interface IQuoteService
{
    Task<ActionResult<QuoteDetailDto>> CreateAsync(
        Guid projectId,
        CreateQuoteRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult<IReadOnlyList<QuoteSummaryDto>>> ListAsync(
        ClaimsPrincipal user,
        QuoteStatus? status,
        int skip,
        int take,
        CancellationToken cancellationToken);

    Task<ActionResult<QuoteDetailDto>> GetAsync(
        Guid id,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult> CancelAsync(
        Guid id,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult> CloseAsync(
        Guid id,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);
}
