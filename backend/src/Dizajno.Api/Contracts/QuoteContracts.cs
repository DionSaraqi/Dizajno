using System.ComponentModel.DataAnnotations;
using Dizajno.Domain.Enums;

namespace Dizajno.Api.Contracts;

// ── Requester side ─────────────────────────────────────────────────────────

public sealed record CreateQuoteRequest(string? Message);

public sealed record QuoteSummaryDto(
    Guid Id,
    Guid ProjectId,
    string ProjectName,
    string? ProjectThumbnailUrl,
    QuoteStatus Status,
    string? Message,
    DateTime CreatedAt,
    DateTime? ClosedAt,
    int SupplierCount,
    int RespondedCount,
    int DeclinedCount);

public sealed record QuoteDetailDto(
    Guid Id,
    Guid ProjectId,
    string ProjectName,
    string? ProjectThumbnailUrl,
    Guid RequesterUserId,
    QuoteStatus Status,
    string? Message,
    DateTime CreatedAt,
    DateTime? ClosedAt,
    IReadOnlyList<QuoteRequestDto> Requests);

public sealed record QuoteRequestDto(
    Guid Id,
    Guid SupplierId,
    string SupplierSlug,
    string SupplierName,
    QuoteRequestStatus Status,
    DateTime? ExpiresAt,
    DateTime CreatedAt,
    IReadOnlyList<QuoteLineDto> Lines,
    QuoteResponseDto? Response);

public sealed record QuoteLineDto(
    Guid Id,
    Guid ProductVariantId,
    System.Text.Json.JsonElement VariantSnapshot,
    decimal Quantity,
    string QuantityUnit,
    Dictionary<string, object>? MaterialOverrides,
    decimal? ScaledWidth,
    decimal? ScaledDepth,
    decimal? ScaledHeight,
    bool IsCustomSize,
    decimal? SuggestedPrice,
    string Currency);

public sealed record QuoteResponseDto(
    Guid Id,
    Guid RespondedByUserId,
    decimal TotalPrice,
    string Currency,
    string? Body,
    DateTime RespondedAt,
    IReadOnlyList<QuoteResponseAttachmentDto> Attachments);

public sealed record QuoteResponseAttachmentDto(
    Guid Id,
    Guid AssetId,
    string Url,
    string MimeType,
    long SizeBytes,
    int SortOrder);

// ── Supplier side ──────────────────────────────────────────────────────────

public sealed record SupplierQuoteRequestSummaryDto(
    Guid Id,
    Guid QuoteId,
    Guid SupplierId,
    string SupplierName,
    QuoteRequestStatus Status,
    DateTime CreatedAt,
    DateTime? ExpiresAt,
    Guid ProjectId,
    string ProjectName,
    string? ProjectThumbnailUrl,
    string RequesterDisplayName,
    int LineCount,
    bool HasResponse);

public sealed record SupplierQuoteRequestDetailDto(
    Guid Id,
    Guid QuoteId,
    Guid SupplierId,
    string SupplierName,
    QuoteRequestStatus Status,
    QuoteStatus QuoteStatus,
    DateTime CreatedAt,
    DateTime? ExpiresAt,
    Guid ProjectId,
    string ProjectName,
    string? ProjectThumbnailUrl,
    string RequesterDisplayName,
    string? Message,
    IReadOnlyList<QuoteLineDto> Lines,
    QuoteResponseDto? Response);

public sealed record SupplierRespondRequest(
    [Range(0, double.MaxValue)] decimal TotalPrice,
    [Required, MinLength(3), MaxLength(3)] string Currency,
    string? Body,
    IReadOnlyList<Guid>? AttachmentAssetIds);

public sealed record SupplierDeclineRequest(string? Reason);
