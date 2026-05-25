using System.Security.Claims;
using System.Text.Json;
using Dizajno.Dto.Admin;
using Dizajno.Dto.Asset;
using Dizajno.Dto.Auth;
using Dizajno.Dto.Catalog;
using Dizajno.Dto.Project;
using Dizajno.Dto.Quote;
using Dizajno.Dto.Share;
using Dizajno.Dto.Supplier;
using Dizajno.Application.Interfaces;
using Dizajno.Domain.Entities;
using Dizajno.Domain.Enums;
using Dizajno.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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
    private readonly DizajnoDbContext _db;
    private readonly ISupplierMembershipResolver _memberships;

    public SupplierQuotesController(
        DizajnoDbContext db,
        ISupplierMembershipResolver memberships)
    {
        _db = db;
        _memberships = memberships;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SupplierQuoteRequestSummaryDto>>> List(
        CancellationToken cancellationToken,
        [FromQuery] QuoteRequestStatus? status = null,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();

        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);
        var supplierIdSet = memberships.ActiveSupplierIds();
        if (supplierIdSet.Count == 0) return Forbid();
        var supplierIds = supplierIdSet.ToList();
        take = Math.Clamp(take, 1, 200);
        skip = Math.Max(0, skip);

        var query = _db.QuoteRequests
            .AsNoTracking()
            .Where(r => supplierIds.Contains(r.SupplierId));
        if (status is { } st) query = query.Where(r => r.Status == st);

        var rows = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip(skip)
            .Take(take)
            .Select(r => new SupplierQuoteRequestSummaryDto(
                r.Id,
                r.QuoteId,
                r.SupplierId,
                r.Supplier.Name,
                r.Status,
                r.CreatedAt,
                r.ExpiresAt,
                r.Quote.ProjectId,
                r.Quote.Project.Name,
                r.Quote.Project.ThumbnailAsset != null ? r.Quote.Project.ThumbnailAsset.Url : null,
                _db.Users.Where(u => u.Id == r.Quote.RequesterUserId)
                    .Select(u => u.DisplayName ?? u.Email ?? string.Empty)
                    .FirstOrDefault() ?? string.Empty,
                r.Lines.Count(),
                r.Response != null))
            .ToListAsync(cancellationToken);

        return Ok(rows);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<SupplierQuoteRequestDetailDto>> Get(
        Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);
        var supplierIds = memberships.ActiveSupplierIds();
        if (supplierIds.Count == 0) return Forbid();

        var head = await _db.QuoteRequests
            .AsNoTracking()
            .Where(r => r.Id == id)
            .Select(r => new
            {
                r.Id,
                r.QuoteId,
                r.SupplierId,
                SupplierName = r.Supplier.Name,
                r.Status,
                QuoteStatus = r.Quote.Status,
                r.CreatedAt,
                r.ExpiresAt,
                ProjectId = r.Quote.ProjectId,
                ProjectName = r.Quote.Project.Name,
                ProjectThumbnailUrl = r.Quote.Project.ThumbnailAsset != null ? r.Quote.Project.ThumbnailAsset.Url : null,
                RequesterDisplayName = _db.Users.Where(u => u.Id == r.Quote.RequesterUserId)
                    .Select(u => u.DisplayName ?? u.Email ?? string.Empty)
                    .FirstOrDefault() ?? string.Empty,
                Message = r.Quote.Message
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (head is null) return NotFound();
        if (!supplierIds.Contains(head.SupplierId)) return Forbid();

        var lines = await LoadLinesAsync(id, cancellationToken);
        var response = await LoadResponseAsync(id, cancellationToken);

        return Ok(new SupplierQuoteRequestDetailDto(
            head.Id, head.QuoteId, head.SupplierId, head.SupplierName,
            head.Status, head.QuoteStatus, head.CreatedAt, head.ExpiresAt,
            head.ProjectId, head.ProjectName, head.ProjectThumbnailUrl,
            head.RequesterDisplayName, head.Message,
            lines, response));
    }

    [HttpPost("{id:guid}/respond")]
    public async Task<ActionResult<QuoteResponseDto>> Respond(
        Guid id,
        SupplierRespondRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var membershipIds = (await _memberships.GetMembershipsAsync(userId, cancellationToken))
            .ActiveSupplierIds();
        if (membershipIds.Count == 0) return Forbid();

        var quoteRequest = await _db.QuoteRequests
            .Include(r => r.Quote)
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
        if (quoteRequest is null) return NotFound();
        if (!membershipIds.Contains(quoteRequest.SupplierId)) return Forbid();

        if (quoteRequest.Quote.Status is QuoteStatus.Closed or QuoteStatus.Cancelled)
        {
            return Problem(
                $"Parent quote is {quoteRequest.Quote.Status}; responses are locked.",
                statusCode: StatusCodes.Status409Conflict);
        }
        if (quoteRequest.Status == QuoteRequestStatus.Expired)
        {
            return Problem(
                "Request expired.",
                statusCode: StatusCodes.Status409Conflict);
        }
        if (request.TotalPrice < 0)
        {
            return Problem(
                "Total price must be non-negative.",
                statusCode: StatusCodes.Status400BadRequest);
        }
        if (string.IsNullOrWhiteSpace(request.Currency) || request.Currency.Length != 3)
        {
            return Problem(
                "Currency must be a 3-letter ISO code.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        // Validate attachment ownership: every asset must be owned by the supplier.
        var attachmentIds = (request.AttachmentAssetIds ?? Array.Empty<Guid>()).Distinct().ToList();
        if (attachmentIds.Count > 0)
        {
            var validAssets = await _db.Assets
                .Where(a => attachmentIds.Contains(a.Id) && a.OwnerSupplierId == quoteRequest.SupplierId)
                .Select(a => a.Id)
                .ToListAsync(cancellationToken);
            var missing = attachmentIds.Except(validAssets).ToList();
            if (missing.Count > 0)
            {
                return Problem(
                    $"Attachment(s) {string.Join(", ", missing)} not owned by supplier.",
                    statusCode: StatusCodes.Status400BadRequest);
            }
        }

        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);

        var existing = await _db.QuoteResponses
            .Include(r => r.Attachments)
            .FirstOrDefaultAsync(r => r.QuoteRequestId == id, cancellationToken);
        QuoteResponse response;
        if (existing is null)
        {
            response = new QuoteResponse
            {
                Id = Guid.NewGuid(),
                QuoteRequestId = id,
                RespondedByUserId = userId,
                TotalPrice = request.TotalPrice,
                Currency = request.Currency.ToUpperInvariant(),
                Body = string.IsNullOrWhiteSpace(request.Body) ? null : request.Body.Trim(),
                RespondedAt = DateTime.UtcNow
            };
            _db.QuoteResponses.Add(response);
        }
        else
        {
            existing.RespondedByUserId = userId;
            existing.TotalPrice = request.TotalPrice;
            existing.Currency = request.Currency.ToUpperInvariant();
            existing.Body = string.IsNullOrWhiteSpace(request.Body) ? null : request.Body.Trim();
            existing.RespondedAt = DateTime.UtcNow;
            _db.QuoteResponseAssets.RemoveRange(existing.Attachments);
            response = existing;
        }

        for (var i = 0; i < attachmentIds.Count; i++)
        {
            _db.QuoteResponseAssets.Add(new QuoteResponseAsset
            {
                Id = Guid.NewGuid(),
                ResponseId = response.Id,
                AssetId = attachmentIds[i],
                SortOrder = i
            });
        }

        quoteRequest.Status = QuoteRequestStatus.Responded;
        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        var dto = await LoadResponseAsync(id, cancellationToken);
        return Ok(dto!);
    }

    [HttpPost("{id:guid}/decline")]
    public async Task<ActionResult> Decline(
        Guid id,
        SupplierDeclineRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var membershipIds = (await _memberships.GetMembershipsAsync(userId, cancellationToken))
            .ActiveSupplierIds();
        if (membershipIds.Count == 0) return Forbid();

        var quoteRequest = await _db.QuoteRequests
            .Include(r => r.Quote)
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
        if (quoteRequest is null) return NotFound();
        if (!membershipIds.Contains(quoteRequest.SupplierId)) return Forbid();

        if (quoteRequest.Quote.Status is QuoteStatus.Closed or QuoteStatus.Cancelled)
        {
            return Problem(
                $"Parent quote is {quoteRequest.Quote.Status}; cannot decline.",
                statusCode: StatusCodes.Status409Conflict);
        }

        quoteRequest.Status = QuoteRequestStatus.Declined;

        // Store the decline reason as a zero-priced response so the requester sees it
        // in their inbox uniformly with normal responses.
        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
        var existing = await _db.QuoteResponses
            .Include(r => r.Attachments)
            .FirstOrDefaultAsync(r => r.QuoteRequestId == id, cancellationToken);
        if (existing is null)
        {
            _db.QuoteResponses.Add(new QuoteResponse
            {
                Id = Guid.NewGuid(),
                QuoteRequestId = id,
                RespondedByUserId = userId,
                TotalPrice = 0m,
                Currency = "EUR",
                Body = string.IsNullOrWhiteSpace(request.Reason) ? "Declined." : request.Reason.Trim(),
                RespondedAt = DateTime.UtcNow
            });
        }
        else
        {
            existing.RespondedByUserId = userId;
            existing.TotalPrice = 0m;
            existing.Body = string.IsNullOrWhiteSpace(request.Reason) ? "Declined." : request.Reason.Trim();
            existing.RespondedAt = DateTime.UtcNow;
            _db.QuoteResponseAssets.RemoveRange(existing.Attachments);
        }
        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        return NoContent();
    }

    private async Task<IReadOnlyList<QuoteLineDto>> LoadLinesAsync(
        Guid requestId, CancellationToken cancellationToken)
    {
        var rows = await _db.QuoteLines
            .AsNoTracking()
            .Where(l => l.QuoteRequestId == requestId)
            .Select(l => new
            {
                l.Id,
                l.ProductVariantId,
                l.VariantSnapshot,
                l.Quantity,
                l.QuantityUnit,
                l.MaterialOverrides,
                l.ScaledWidth,
                l.ScaledDepth,
                l.ScaledHeight,
                l.IsCustomSize,
                l.SuggestedPrice,
                l.Currency
            })
            .ToListAsync(cancellationToken);

        return rows.Select(l => new QuoteLineDto(
            l.Id, l.ProductVariantId,
            QuotesController.ParseJsonElement(l.VariantSnapshot),
            l.Quantity, l.QuantityUnit,
            QuotesController.ParseDict(l.MaterialOverrides),
            l.ScaledWidth, l.ScaledDepth, l.ScaledHeight,
            l.IsCustomSize, l.SuggestedPrice, l.Currency)).ToList();
    }

    private async Task<QuoteResponseDto?> LoadResponseAsync(
        Guid requestId, CancellationToken cancellationToken)
    {
        var row = await _db.QuoteResponses
            .AsNoTracking()
            .Where(r => r.QuoteRequestId == requestId)
            .Select(r => new
            {
                r.Id,
                r.RespondedByUserId,
                r.TotalPrice,
                r.Currency,
                r.Body,
                r.RespondedAt,
                Attachments = r.Attachments
                    .OrderBy(a => a.SortOrder)
                    .Select(a => new QuoteResponseAttachmentDto(
                        a.Id, a.AssetId, a.Asset.Url, a.Asset.MimeType, a.Asset.SizeBytes, a.SortOrder))
                    .ToList()
            })
            .FirstOrDefaultAsync(cancellationToken);

        return row is null
            ? null
            : new QuoteResponseDto(
                row.Id, row.RespondedByUserId, row.TotalPrice, row.Currency, row.Body, row.RespondedAt,
                row.Attachments);
    }

    private bool TryGetUserId(out Guid userId)
    {
        var raw = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(raw, out userId);
    }
}
