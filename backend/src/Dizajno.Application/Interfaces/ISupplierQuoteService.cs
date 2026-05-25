using System.Security.Claims;
using Dizajno.Domain.Enums;
using Dizajno.Dto.Quote;
using Microsoft.AspNetCore.Mvc;

namespace Dizajno.Application.Interfaces;

public interface ISupplierQuoteService
{
    Task<ActionResult<IReadOnlyList<SupplierQuoteRequestSummaryDto>>> ListAsync(
        ClaimsPrincipal user,
        QuoteRequestStatus? status,
        int skip,
        int take,
        CancellationToken cancellationToken);

    Task<ActionResult<SupplierQuoteRequestDetailDto>> GetAsync(
        Guid id,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult<QuoteResponseDto>> RespondAsync(
        Guid id,
        SupplierRespondRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);

    Task<ActionResult> DeclineAsync(
        Guid id,
        SupplierDeclineRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken);
}
