using System.Security.Claims;
using System.Text.Json;
using Dizajno.Api.Contracts;
using Dizajno.Domain.Entities;
using Dizajno.Domain.Enums;
using Dizajno.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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
    internal const decimal CustomSizeToleranceMeters = 0.001m;

    internal static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web)
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    private readonly DizajnoDbContext _db;

    public QuotesController(DizajnoDbContext db) => _db = db;

    // ── POST /api/projects/{id}/quotes — fan out per supplier ──────────────

    [HttpPost("projects/{projectId:guid}/quotes")]
    public async Task<ActionResult<QuoteDetailDto>> Create(
        Guid projectId,
        CreateQuoteRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();

        var project = await _db.Projects
            .Where(p => p.Id == projectId && p.OwnerUserId == userId && p.DeletedAt == null)
            .Select(p => new { p.Id, p.Name, ThumbnailUrl = p.ThumbnailAsset != null ? p.ThumbnailAsset.Url : null })
            .FirstOrDefaultAsync(cancellationToken);
        if (project is null) return NotFound();

        // Pull every placed item joined with its variant + product + supplier so the
        // snapshot is one fast query rather than N round-trips.
        var placed = await _db.PlacedItems
            .AsNoTracking()
            .Where(p => p.ProjectId == projectId)
            .Select(p => new
            {
                p.Id,
                p.ProductVariantId,
                p.Scale,
                p.ScaledWidth,
                p.ScaledDepth,
                p.ScaledHeight,
                p.MaterialColors,
                p.MaterialTextures,
                Variant = new
                {
                    p.ProductVariant.Id,
                    p.ProductVariant.Sku,
                    p.ProductVariant.Name,
                    p.ProductVariant.Width,
                    p.ProductVariant.Depth,
                    p.ProductVariant.Height,
                    p.ProductVariant.Currency,
                    p.ProductVariant.BasePrice,
                    Product = new
                    {
                        p.ProductVariant.Product.Id,
                        p.ProductVariant.Product.Slug,
                        p.ProductVariant.Product.Name,
                        p.ProductVariant.Product.Family,
                        p.ProductVariant.Product.SupplierId,
                        SupplierSlug = p.ProductVariant.Product.Supplier.Slug,
                        SupplierName = p.ProductVariant.Product.Supplier.Name
                    }
                }
            })
            .ToListAsync(cancellationToken);

        if (placed.Count == 0)
        {
            return Problem(
                "Project has no placed items to quote.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        var now = DateTime.UtcNow;
        var quote = new Quote
        {
            Id = Guid.NewGuid(),
            ProjectId = projectId,
            RequesterUserId = userId,
            Status = QuoteStatus.Open,
            Message = string.IsNullOrWhiteSpace(request.Message) ? null : request.Message.Trim(),
            CreatedAt = now
        };
        _db.Quotes.Add(quote);

        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);

        foreach (var supplierGroup in placed.GroupBy(p => p.Variant.Product.SupplierId))
        {
            var quoteRequest = new QuoteRequest
            {
                Id = Guid.NewGuid(),
                QuoteId = quote.Id,
                SupplierId = supplierGroup.Key,
                Status = QuoteRequestStatus.Pending,
                CreatedAt = now
            };
            _db.QuoteRequests.Add(quoteRequest);

            foreach (var item in supplierGroup)
            {
                var snapshot = new
                {
                    variantId = item.Variant.Id,
                    sku = item.Variant.Sku,
                    name = item.Variant.Name,
                    supplierId = item.Variant.Product.SupplierId,
                    supplierSlug = item.Variant.Product.SupplierSlug,
                    supplierName = item.Variant.Product.SupplierName,
                    productSlug = item.Variant.Product.Slug,
                    productName = item.Variant.Product.Name,
                    family = item.Variant.Product.Family.ToString(),
                    stockWidth = item.Variant.Width,
                    stockDepth = item.Variant.Depth,
                    stockHeight = item.Variant.Height,
                    currency = item.Variant.Currency,
                    basePrice = item.Variant.BasePrice
                };

                var isCustom = IsCustomSize(item.Variant.Width, item.Variant.Depth, item.Variant.Height,
                    item.ScaledWidth, item.ScaledDepth, item.ScaledHeight);

                _db.QuoteLines.Add(new QuoteLine
                {
                    Id = Guid.NewGuid(),
                    QuoteRequestId = quoteRequest.Id,
                    ProductVariantId = item.Variant.Id,
                    VariantSnapshot = JsonSerializer.Serialize(snapshot, JsonOpts),
                    Quantity = 1m,
                    QuantityUnit = "piece",
                    MaterialOverrides = BuildMaterialOverrides(item.MaterialColors, item.MaterialTextures),
                    ScaledWidth = item.ScaledWidth,
                    ScaledDepth = item.ScaledDepth,
                    ScaledHeight = item.ScaledHeight,
                    IsCustomSize = isCustom,
                    SuggestedPrice = item.Variant.BasePrice,
                    Currency = string.IsNullOrWhiteSpace(item.Variant.Currency) ? "EUR" : item.Variant.Currency
                });
            }
        }

        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        return StatusCode(StatusCodes.Status201Created,
            await BuildDetailAsync(quote.Id, userId, cancellationToken)
            ?? throw new InvalidOperationException("Quote disappeared after insert."));
    }

    // ── GET /api/quotes ────────────────────────────────────────────────────

    [HttpGet("quotes")]
    public async Task<ActionResult<IReadOnlyList<QuoteSummaryDto>>> List(
        CancellationToken cancellationToken,
        [FromQuery] QuoteStatus? status = null,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();

        take = Math.Clamp(take, 1, 200);
        skip = Math.Max(0, skip);

        var quotesQuery = _db.Quotes
            .AsNoTracking()
            .Where(q => q.RequesterUserId == userId);
        if (status is { } st) quotesQuery = quotesQuery.Where(q => q.Status == st);

        var rows = await quotesQuery
            .OrderByDescending(q => q.CreatedAt)
            .Skip(skip)
            .Take(take)
            .Select(q => new
            {
                q.Id,
                q.ProjectId,
                ProjectName = q.Project.Name,
                ProjectThumbnailUrl = q.Project.ThumbnailAsset != null ? q.Project.ThumbnailAsset.Url : null,
                q.Status,
                q.Message,
                q.CreatedAt,
                q.ClosedAt,
                SupplierCount = q.Requests.Count(),
                RespondedCount = q.Requests.Count(r => r.Status == QuoteRequestStatus.Responded),
                DeclinedCount = q.Requests.Count(r => r.Status == QuoteRequestStatus.Declined)
            })
            .ToListAsync(cancellationToken);

        return Ok(rows.Select(r => new QuoteSummaryDto(
            r.Id, r.ProjectId, r.ProjectName, r.ProjectThumbnailUrl,
            r.Status, r.Message, r.CreatedAt, r.ClosedAt,
            r.SupplierCount, r.RespondedCount, r.DeclinedCount)).ToList());
    }

    // ── GET /api/quotes/{id} ───────────────────────────────────────────────

    [HttpGet("quotes/{id:guid}")]
    public async Task<ActionResult<QuoteDetailDto>> Get(
        Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var detail = await BuildDetailAsync(id, userId, cancellationToken);
        if (detail is null) return NotFound();
        return Ok(detail);
    }

    // ── POST /api/quotes/{id}/cancel ───────────────────────────────────────

    [HttpPost("quotes/{id:guid}/cancel")]
    public async Task<ActionResult> Cancel(Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();

        var quote = await _db.Quotes
            .FirstOrDefaultAsync(q => q.Id == id && q.RequesterUserId == userId, cancellationToken);
        if (quote is null) return NotFound();

        if (quote.Status != QuoteStatus.Open)
        {
            return Problem(
                $"Quote is already {quote.Status}.",
                statusCode: StatusCodes.Status409Conflict);
        }

        var now = DateTime.UtcNow;
        quote.Status = QuoteStatus.Cancelled;
        quote.ClosedAt = now;

        await _db.QuoteRequests
            .Where(r => r.QuoteId == id && r.Status == QuoteRequestStatus.Pending)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, QuoteRequestStatus.Expired),
                cancellationToken);

        await _db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    // ── POST /api/quotes/{id}/close ────────────────────────────────────────

    [HttpPost("quotes/{id:guid}/close")]
    public async Task<ActionResult> Close(Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();

        // A supplier has "engaged" with the request once their status leaves Pending —
        // Responded (priced) and Declined (said no) both count, since either way the
        // requester now knows enough to close the conversation.
        var quote = await _db.Quotes
            .Where(q => q.Id == id && q.RequesterUserId == userId)
            .Select(q => new
            {
                Quote = q,
                AnyEngaged = q.Requests.Any(r =>
                    r.Status == QuoteRequestStatus.Responded ||
                    r.Status == QuoteRequestStatus.Declined)
            })
            .FirstOrDefaultAsync(cancellationToken);
        if (quote is null) return NotFound();

        if (quote.Quote.Status != QuoteStatus.Open)
        {
            return Problem(
                $"Quote is already {quote.Quote.Status}.",
                statusCode: StatusCodes.Status409Conflict);
        }
        if (!quote.AnyEngaged)
        {
            return Problem(
                "Cannot close before any supplier has responded or declined.",
                statusCode: StatusCodes.Status409Conflict);
        }

        quote.Quote.Status = QuoteStatus.Closed;
        quote.Quote.ClosedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private async Task<QuoteDetailDto?> BuildDetailAsync(
        Guid quoteId, Guid requesterUserId, CancellationToken cancellationToken)
    {
        var quote = await _db.Quotes
            .AsNoTracking()
            .Where(q => q.Id == quoteId && q.RequesterUserId == requesterUserId)
            .Select(q => new
            {
                q.Id,
                q.ProjectId,
                ProjectName = q.Project.Name,
                ProjectThumbnailUrl = q.Project.ThumbnailAsset != null ? q.Project.ThumbnailAsset.Url : null,
                q.RequesterUserId,
                q.Status,
                q.Message,
                q.CreatedAt,
                q.ClosedAt
            })
            .FirstOrDefaultAsync(cancellationToken);
        if (quote is null) return null;

        var requests = await LoadRequestsAsync(new[] { quoteId }, cancellationToken);
        return new QuoteDetailDto(
            quote.Id, quote.ProjectId, quote.ProjectName, quote.ProjectThumbnailUrl,
            quote.RequesterUserId, quote.Status, quote.Message, quote.CreatedAt, quote.ClosedAt,
            requests.TryGetValue(quoteId, out var list) ? list : Array.Empty<QuoteRequestDto>());
    }

    internal async Task<Dictionary<Guid, IReadOnlyList<QuoteRequestDto>>> LoadRequestsAsync(
        IReadOnlyCollection<Guid> quoteIds,
        CancellationToken cancellationToken)
    {
        if (quoteIds.Count == 0) return new();

        var rows = await _db.QuoteRequests
            .AsNoTracking()
            .Where(r => quoteIds.Contains(r.QuoteId))
            .Select(r => new
            {
                r.Id,
                r.QuoteId,
                r.SupplierId,
                SupplierSlug = r.Supplier.Slug,
                SupplierName = r.Supplier.Name,
                r.Status,
                r.ExpiresAt,
                r.CreatedAt
            })
            .ToListAsync(cancellationToken);

        var requestIds = rows.Select(r => r.Id).ToList();
        var linesByRequest = await LoadLinesAsync(requestIds, cancellationToken);
        var responsesByRequest = await LoadResponsesAsync(requestIds, cancellationToken);

        var dtos = rows.Select(r => new QuoteRequestDto(
            r.Id, r.SupplierId, r.SupplierSlug, r.SupplierName, r.Status, r.ExpiresAt, r.CreatedAt,
            linesByRequest.TryGetValue(r.Id, out var ls) ? ls : Array.Empty<QuoteLineDto>(),
            responsesByRequest.TryGetValue(r.Id, out var rsp) ? rsp : null));

        return dtos
            .GroupBy(d => rows.First(r => r.Id == d.Id).QuoteId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<QuoteRequestDto>)g.OrderBy(d => d.SupplierName).ToList());
    }

    internal async Task<Dictionary<Guid, IReadOnlyList<QuoteLineDto>>> LoadLinesAsync(
        IReadOnlyCollection<Guid> requestIds,
        CancellationToken cancellationToken)
    {
        if (requestIds.Count == 0) return new();

        var rows = await _db.QuoteLines
            .AsNoTracking()
            .Where(l => requestIds.Contains(l.QuoteRequestId))
            .Select(l => new
            {
                l.Id,
                l.QuoteRequestId,
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

        return rows.GroupBy(r => r.QuoteRequestId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<QuoteLineDto>)g.Select(l => new QuoteLineDto(
                l.Id, l.ProductVariantId,
                ParseJsonElement(l.VariantSnapshot),
                l.Quantity, l.QuantityUnit,
                ParseDict(l.MaterialOverrides),
                l.ScaledWidth, l.ScaledDepth, l.ScaledHeight,
                l.IsCustomSize, l.SuggestedPrice, l.Currency)).ToList());
    }

    internal async Task<Dictionary<Guid, QuoteResponseDto>> LoadResponsesAsync(
        IReadOnlyCollection<Guid> requestIds,
        CancellationToken cancellationToken)
    {
        if (requestIds.Count == 0) return new();

        var rows = await _db.QuoteResponses
            .AsNoTracking()
            .Where(r => requestIds.Contains(r.QuoteRequestId))
            .Select(r => new
            {
                r.Id,
                r.QuoteRequestId,
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
            .ToListAsync(cancellationToken);

        return rows.ToDictionary(r => r.QuoteRequestId, r => new QuoteResponseDto(
            r.Id, r.RespondedByUserId, r.TotalPrice, r.Currency, r.Body, r.RespondedAt,
            r.Attachments));
    }

    internal static System.Text.Json.JsonElement ParseJsonElement(string json)
    {
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.Clone();
    }

    internal static Dictionary<string, object>? ParseDict(string? json)
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

    internal static string? BuildMaterialOverrides(string? colors, string? textures)
    {
        if (string.IsNullOrWhiteSpace(colors) && string.IsNullOrWhiteSpace(textures))
        {
            return null;
        }
        var payload = new Dictionary<string, JsonElement>();
        if (!string.IsNullOrWhiteSpace(colors))
        {
            payload["materialColors"] = JsonDocument.Parse(colors).RootElement.Clone();
        }
        if (!string.IsNullOrWhiteSpace(textures))
        {
            payload["materialTextures"] = JsonDocument.Parse(textures).RootElement.Clone();
        }
        return JsonSerializer.Serialize(payload, JsonOpts);
    }

    internal static bool IsCustomSize(
        decimal stockW, decimal stockD, decimal stockH,
        decimal? scaledW, decimal? scaledD, decimal? scaledH)
    {
        static bool Differs(decimal stock, decimal? scaled) =>
            scaled is { } s && Math.Abs(stock - s) > CustomSizeToleranceMeters;
        return Differs(stockW, scaledW) || Differs(stockD, scaledD) || Differs(stockH, scaledH);
    }

    private bool TryGetUserId(out Guid userId)
    {
        var raw = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(raw, out userId);
    }
}
