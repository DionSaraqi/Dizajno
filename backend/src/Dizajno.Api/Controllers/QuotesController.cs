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

        // Anonymous-typed projection of the fields needed to build a variant_snapshot.
        // Kept as a local because EF can't translate a method call inside .Select().
        // Materialised rows are translated to VariantSnapshotSource in-memory below.
        var placedRaw = await _db.PlacedItems
            .AsNoTracking()
            .Where(p => p.ProjectId == projectId)
            .Select(p => new
            {
                p.ScaledWidth,
                p.ScaledDepth,
                p.ScaledHeight,
                p.MaterialColors,
                p.MaterialTextures,
                VariantId = p.ProductVariant.Id,
                p.ProductVariant.Sku,
                VariantName = p.ProductVariant.Name,
                p.ProductVariant.Width,
                p.ProductVariant.Depth,
                p.ProductVariant.Height,
                p.ProductVariant.Currency,
                p.ProductVariant.BasePrice,
                ProductId = p.ProductVariant.Product.Id,
                ProductSlug = p.ProductVariant.Product.Slug,
                ProductName = p.ProductVariant.Product.Name,
                Family = p.ProductVariant.Product.Family,
                SupplierId = p.ProductVariant.Product.SupplierId,
                SupplierSlug = p.ProductVariant.Product.Supplier.Slug,
                SupplierName = p.ProductVariant.Product.Supplier.Name
            })
            .ToListAsync(cancellationToken);

        var placed = placedRaw.Select(p => new
        {
            p.ScaledWidth,
            p.ScaledDepth,
            p.ScaledHeight,
            p.MaterialColors,
            p.MaterialTextures,
            Variant = new VariantSnapshotSource(
                p.VariantId, p.Sku, p.VariantName, p.Width, p.Depth, p.Height,
                p.Currency, p.BasePrice, p.ProductId, p.ProductSlug, p.ProductName,
                p.Family, p.SupplierId, p.SupplierSlug, p.SupplierName)
        }).ToList();

        // Phase 6: openings that point at a branded fixture variant become quote lines
        // alongside placed items. Generic openings (no FK) are skipped.
        var brandedOpeningsRaw = await _db.Openings
            .AsNoTracking()
            .Where(o => o.ProjectId == projectId && o.ProductVariantId != null)
            .Select(o => new
            {
                o.Width,
                OpeningHeight = o.Height,
                o.MaterialOverrides,
                VariantId = o.ProductVariant!.Id,
                o.ProductVariant!.Sku,
                VariantName = o.ProductVariant!.Name,
                VariantWidth = o.ProductVariant!.Width,
                VariantDepth = o.ProductVariant!.Depth,
                VariantHeight = o.ProductVariant!.Height,
                o.ProductVariant!.Currency,
                o.ProductVariant!.BasePrice,
                ProductId = o.ProductVariant!.Product.Id,
                ProductSlug = o.ProductVariant!.Product.Slug,
                ProductName = o.ProductVariant!.Product.Name,
                Family = o.ProductVariant!.Product.Family,
                SupplierId = o.ProductVariant!.Product.SupplierId,
                SupplierSlug = o.ProductVariant!.Product.Supplier.Slug,
                SupplierName = o.ProductVariant!.Product.Supplier.Name
            })
            .ToListAsync(cancellationToken);

        var brandedOpenings = brandedOpeningsRaw.Select(o => new
        {
            o.Width,
            o.OpeningHeight,
            o.MaterialOverrides,
            Variant = new VariantSnapshotSource(
                o.VariantId, o.Sku, o.VariantName,
                o.VariantWidth, o.VariantDepth, o.VariantHeight,
                o.Currency, o.BasePrice, o.ProductId, o.ProductSlug, o.ProductName,
                o.Family, o.SupplierId, o.SupplierSlug, o.SupplierName)
        }).ToList();

        // Phase 6: manual lines (paint, flooring, etc.) submitted by the client. Each
        // must reference a Published variant before being inserted; bad ids return 400.
        var manualLines = request.ManualLines ?? Array.Empty<ManualQuoteLineRequest>();
        var manualVariants = new Dictionary<Guid, VariantSnapshotSource>();
        if (manualLines.Count > 0)
        {
            foreach (var line in manualLines)
            {
                if (line.Quantity <= 0)
                {
                    return Problem(
                        $"Manual line quantity must be positive (variant {line.ProductVariantId}).",
                        statusCode: StatusCodes.Status400BadRequest);
                }
                if (string.IsNullOrWhiteSpace(line.QuantityUnit))
                {
                    return Problem(
                        $"Manual line quantity unit is required (variant {line.ProductVariantId}).",
                        statusCode: StatusCodes.Status400BadRequest);
                }
            }

            var ids = manualLines.Select(l => l.ProductVariantId).Distinct().ToList();
            var loadedRaw = await _db.ProductVariants
                .AsNoTracking()
                .Where(v => ids.Contains(v.Id) && v.Product.Status == ProductStatus.Published)
                .Select(v => new
                {
                    VariantId = v.Id,
                    v.Sku,
                    VariantName = v.Name,
                    v.Width,
                    v.Depth,
                    v.Height,
                    v.Currency,
                    v.BasePrice,
                    ProductId = v.Product.Id,
                    ProductSlug = v.Product.Slug,
                    ProductName = v.Product.Name,
                    Family = v.Product.Family,
                    SupplierId = v.Product.SupplierId,
                    SupplierSlug = v.Product.Supplier.Slug,
                    SupplierName = v.Product.Supplier.Name
                })
                .ToListAsync(cancellationToken);

            var loadedIds = loadedRaw.Select(l => l.VariantId).ToHashSet();
            var missing = ids.Where(i => !loadedIds.Contains(i)).ToList();
            if (missing.Count > 0)
            {
                return Problem(
                    $"Manual line variant(s) not found or unpublished: {string.Join(", ", missing)}",
                    statusCode: StatusCodes.Status400BadRequest);
            }

            foreach (var row in loadedRaw)
            {
                manualVariants[row.VariantId] = new VariantSnapshotSource(
                    row.VariantId, row.Sku, row.VariantName,
                    row.Width, row.Depth, row.Height,
                    row.Currency, row.BasePrice, row.ProductId, row.ProductSlug, row.ProductName,
                    row.Family, row.SupplierId, row.SupplierSlug, row.SupplierName);
            }
        }

        if (placed.Count == 0 && brandedOpenings.Count == 0 && manualLines.Count == 0)
        {
            return Problem(
                "Quote must include at least one placed item, branded opening, or manual line.",
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

        // Fold every source (placed items, branded openings, manual lines) into a
        // single stream of pending lines, then group by supplier for the fan-out.
        var pendingLines = new List<PendingLine>(placed.Count + brandedOpenings.Count + manualLines.Count);

        foreach (var item in placed)
        {
            var isCustom = IsCustomSize(
                item.Variant.Width, item.Variant.Depth, item.Variant.Height,
                item.ScaledWidth, item.ScaledDepth, item.ScaledHeight);

            pendingLines.Add(new PendingLine(
                Variant: item.Variant,
                Quantity: 1m,
                QuantityUnit: "piece",
                MaterialOverrides: BuildMaterialOverrides(item.MaterialColors, item.MaterialTextures),
                ScaledWidth: item.ScaledWidth,
                ScaledDepth: item.ScaledDepth,
                ScaledHeight: item.ScaledHeight,
                IsCustomSize: isCustom));
        }

        foreach (var opening in brandedOpenings)
        {
            pendingLines.Add(new PendingLine(
                Variant: opening.Variant,
                Quantity: 1m,
                QuantityUnit: "piece",
                MaterialOverrides: opening.MaterialOverrides,
                ScaledWidth: opening.Width,
                ScaledDepth: null,
                ScaledHeight: opening.OpeningHeight,
                IsCustomSize: false));
        }

        foreach (var line in manualLines)
        {
            var variant = manualVariants[line.ProductVariantId];
            pendingLines.Add(new PendingLine(
                Variant: variant,
                Quantity: line.Quantity,
                QuantityUnit: line.QuantityUnit.Trim(),
                MaterialOverrides: null,
                ScaledWidth: null,
                ScaledDepth: null,
                ScaledHeight: null,
                IsCustomSize: false));
        }

        foreach (var supplierGroup in pendingLines.GroupBy(l => l.Variant.SupplierId))
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

            foreach (var line in supplierGroup)
            {
                _db.QuoteLines.Add(new QuoteLine
                {
                    Id = Guid.NewGuid(),
                    QuoteRequestId = quoteRequest.Id,
                    ProductVariantId = line.Variant.Id,
                    VariantSnapshot = JsonSerializer.Serialize(line.Variant.ToSnapshot(), JsonOpts),
                    Quantity = line.Quantity,
                    QuantityUnit = line.QuantityUnit,
                    MaterialOverrides = line.MaterialOverrides,
                    ScaledWidth = line.ScaledWidth,
                    ScaledDepth = line.ScaledDepth,
                    ScaledHeight = line.ScaledHeight,
                    IsCustomSize = line.IsCustomSize,
                    SuggestedPrice = line.Variant.BasePrice,
                    Currency = string.IsNullOrWhiteSpace(line.Variant.Currency) ? "EUR" : line.Variant.Currency
                });
            }
        }

        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        return StatusCode(StatusCodes.Status201Created,
            await BuildDetailAsync(quote.Id, userId, cancellationToken)
            ?? throw new InvalidOperationException("Quote disappeared after insert."));
    }

    /// <summary>
    /// Captures every variant + product + supplier field that the variant_snapshot
    /// jsonb needs, regardless of which scene source (placed item, branded opening,
    /// manual line) produced the line. Each query materialises plain anonymous types
    /// to keep EF happy, then projects into this record in-memory before fan-out.
    /// </summary>
    private sealed record VariantSnapshotSource(
        Guid Id,
        string Sku,
        string Name,
        decimal Width,
        decimal Depth,
        decimal Height,
        string Currency,
        decimal? BasePrice,
        Guid ProductId,
        string ProductSlug,
        string ProductName,
        ProductFamily Family,
        Guid SupplierId,
        string SupplierSlug,
        string SupplierName)
    {
        public object ToSnapshot() => new
        {
            variantId = Id,
            sku = Sku,
            name = Name,
            supplierId = SupplierId,
            supplierSlug = SupplierSlug,
            supplierName = SupplierName,
            productSlug = ProductSlug,
            productName = ProductName,
            family = Family.ToString(),
            stockWidth = Width,
            stockDepth = Depth,
            stockHeight = Height,
            currency = Currency,
            basePrice = BasePrice
        };
    }

    private sealed record PendingLine(
        VariantSnapshotSource Variant,
        decimal Quantity,
        string QuantityUnit,
        string? MaterialOverrides,
        decimal? ScaledWidth,
        decimal? ScaledDepth,
        decimal? ScaledHeight,
        bool IsCustomSize);

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
