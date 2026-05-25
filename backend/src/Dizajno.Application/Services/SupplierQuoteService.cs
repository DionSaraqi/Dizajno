using System.Security.Claims;
using System.Text.Json;
using Dizajno.Application.Interfaces;
using Dizajno.Data;
using Dizajno.Domain.Entities;
using Dizajno.Domain.Enums;
using Dizajno.Dto.Quote;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dizajno.Application.Services;

public sealed class SupplierQuoteService : ISupplierQuoteService
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web)
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    private readonly DizajnoDbContext _db;
    private readonly ISupplierMembershipResolver _memberships;

    public SupplierQuoteService(
        DizajnoDbContext db,
        ISupplierMembershipResolver memberships)
    {
        _db = db;
        _memberships = memberships;
    }

    public async Task<ActionResult<IReadOnlyList<SupplierQuoteRequestSummaryDto>>> ListAsync(
        ClaimsPrincipal user,
        QuoteRequestStatus? status,
        int skip,
        int take,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();

        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);
        var supplierIdSet = memberships.ActiveSupplierIds();
        if (supplierIdSet.Count == 0) return new ForbidResult();
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

        return new OkObjectResult(rows);
    }

    public async Task<ActionResult<SupplierQuoteRequestDetailDto>> GetAsync(
        Guid id,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);
        var supplierIds = memberships.ActiveSupplierIds();
        if (supplierIds.Count == 0) return new ForbidResult();

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

        if (head is null) return new NotFoundResult();
        if (!supplierIds.Contains(head.SupplierId)) return new ForbidResult();

        var lines = await LoadLinesAsync(id, cancellationToken);
        var response = await LoadResponseAsync(id, cancellationToken);

        return new OkObjectResult(new SupplierQuoteRequestDetailDto(
            head.Id, head.QuoteId, head.SupplierId, head.SupplierName,
            head.Status, head.QuoteStatus, head.CreatedAt, head.ExpiresAt,
            head.ProjectId, head.ProjectName, head.ProjectThumbnailUrl,
            head.RequesterDisplayName, head.Message,
            lines, response));
    }

    public async Task<ActionResult<QuoteResponseDto>> RespondAsync(
        Guid id,
        SupplierRespondRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var membershipIds = (await _memberships.GetMembershipsAsync(userId, cancellationToken))
            .ActiveSupplierIds();
        if (membershipIds.Count == 0) return new ForbidResult();

        var quoteRequest = await _db.QuoteRequests
            .Include(r => r.Quote)
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
        if (quoteRequest is null) return new NotFoundResult();
        if (!membershipIds.Contains(quoteRequest.SupplierId)) return new ForbidResult();

        if (quoteRequest.Quote.Status is QuoteStatus.Closed or QuoteStatus.Cancelled)
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = $"Parent quote is {quoteRequest.Quote.Status}; responses are locked.",
                Status = StatusCodes.Status409Conflict
            }) { StatusCode = StatusCodes.Status409Conflict };
        }
        if (quoteRequest.Status == QuoteRequestStatus.Expired)
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = "Request expired.",
                Status = StatusCodes.Status409Conflict
            }) { StatusCode = StatusCodes.Status409Conflict };
        }
        if (request.TotalPrice < 0)
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = "Total price must be non-negative.",
                Status = StatusCodes.Status400BadRequest
            }) { StatusCode = StatusCodes.Status400BadRequest };
        }
        if (string.IsNullOrWhiteSpace(request.Currency) || request.Currency.Length != 3)
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = "Currency must be a 3-letter ISO code.",
                Status = StatusCodes.Status400BadRequest
            }) { StatusCode = StatusCodes.Status400BadRequest };
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
                return new ObjectResult(new ProblemDetails
                {
                    Detail = $"Attachment(s) {string.Join(", ", missing)} not owned by supplier.",
                    Status = StatusCodes.Status400BadRequest
                }) { StatusCode = StatusCodes.Status400BadRequest };
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
        return new OkObjectResult(dto!);
    }

    public async Task<ActionResult> DeclineAsync(
        Guid id,
        SupplierDeclineRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var membershipIds = (await _memberships.GetMembershipsAsync(userId, cancellationToken))
            .ActiveSupplierIds();
        if (membershipIds.Count == 0) return new ForbidResult();

        var quoteRequest = await _db.QuoteRequests
            .Include(r => r.Quote)
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
        if (quoteRequest is null) return new NotFoundResult();
        if (!membershipIds.Contains(quoteRequest.SupplierId)) return new ForbidResult();

        if (quoteRequest.Quote.Status is QuoteStatus.Closed or QuoteStatus.Cancelled)
        {
            return new ObjectResult(new ProblemDetails
            {
                Detail = $"Parent quote is {quoteRequest.Quote.Status}; cannot decline.",
                Status = StatusCodes.Status409Conflict
            }) { StatusCode = StatusCodes.Status409Conflict };
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

        return new NoContentResult();
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
            ParseJsonElement(l.VariantSnapshot),
            l.Quantity, l.QuantityUnit,
            ParseDict(l.MaterialOverrides),
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

    private static System.Text.Json.JsonElement ParseJsonElement(string json)
    {
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.Clone();
    }

    private static Dictionary<string, object>? ParseDict(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            var element = JsonSerializer.Deserialize<JsonElement>(json, JsonOpts);
            return element.EnumerateObject()
                .ToDictionary(p => p.Name, p => (object)p.Value.Clone());
        }
        catch
        {
            return null;
        }
    }

    private static bool TryGetUserId(ClaimsPrincipal user, out Guid userId)
    {
        var raw = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? user.FindFirst("sub")?.Value;
        return Guid.TryParse(raw, out userId);
    }
}
