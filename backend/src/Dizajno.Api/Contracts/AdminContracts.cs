using System.ComponentModel.DataAnnotations;
using Dizajno.Domain.Enums;

namespace Dizajno.Api.Contracts;

/// <summary>
/// Phase-5 stopgap. Lets admins bind any user to a supplier so the supplier-side
/// endpoints can be exercised before the Phase 7 portal ships the member-management UI.
/// </summary>
public sealed record CreateSupplierMemberRequest(
    [Required] Guid SupplierId,
    [Required] Guid UserId,
    SupplierMemberRole Role);

public sealed record SupplierMemberDto(
    Guid Id,
    Guid SupplierId,
    string SupplierSlug,
    string SupplierName,
    Guid UserId,
    string UserEmail,
    string? UserDisplayName,
    SupplierMemberRole Role,
    DateTime CreatedAt);

// ── Phase 7a — admin dashboard ────────────────────────────────────────────────

public sealed record AdminSupplierDto(
    Guid Id,
    string Slug,
    string Name,
    string? Description,
    string? WebsiteUrl,
    string? ContactEmail,
    string? ContactPhone,
    bool IsTrusted,
    DateTime? SuspendedAt,
    int MemberCount,
    int ProductCount,
    DateTime CreatedAt);

public sealed record CreateSupplierRequest(
    [Required, MaxLength(120)] string Slug,
    [Required, MaxLength(200)] string Name,
    string? Description,
    [MaxLength(500)] string? WebsiteUrl,
    [EmailAddress, MaxLength(320)] string? ContactEmail,
    [MaxLength(50)] string? ContactPhone);

public sealed record UpdateSupplierRequest(
    [Required, MaxLength(200)] string Name,
    string? Description,
    [MaxLength(500)] string? WebsiteUrl,
    [EmailAddress, MaxLength(320)] string? ContactEmail,
    [MaxLength(50)] string? ContactPhone);

public sealed record CreateSupplierInviteRequest(
    [Required] Guid SupplierId,
    [Required, EmailAddress, MaxLength(320)] string Email,
    SupplierMemberRole Role,
    int? ExpiresInDays);

public sealed record SupplierInviteDto(
    Guid Id,
    Guid SupplierId,
    string InvitedEmail,
    SupplierMemberRole Role,
    DateTime ExpiresAt,
    DateTime? AcceptedAt,
    Guid? AcceptedByUserId,
    DateTime? RevokedAt,
    DateTime CreatedAt,
    /// <summary>Returned only on create — never persisted in plaintext.</summary>
    string? Token = null,
    /// <summary>Full URL to embed in whatever channel the admin uses to deliver the invite.</summary>
    string? AcceptUrl = null);

public sealed record InvitePreviewDto(
    string SupplierName,
    string SupplierSlug,
    SupplierMemberRole Role,
    string InvitedEmail,
    DateTime ExpiresAt,
    bool IsExpired,
    bool IsAccepted,
    bool IsRevoked);

public sealed record PendingProductDto(
    Guid Id,
    string Slug,
    string Name,
    string Family,
    string Category,
    Guid SupplierId,
    string SupplierName,
    DateTime CreatedAt);

public sealed record PendingCategoryDto(
    Guid Id,
    string Slug,
    string Name,
    string Family,
    string Path,
    Guid? SuggestedBySupplierId,
    string? SuggestedBySupplierName);

public sealed record AuditLogEntryDto(
    Guid Id,
    Guid? ActorUserId,
    string? ActorEmail,
    string Action,
    string EntityType,
    Guid EntityId,
    string? Diff,
    string? IpAddress,
    DateTime CreatedAt);

public sealed record AuditLogPageDto(
    IReadOnlyList<AuditLogEntryDto> Entries,
    int TotalCount,
    int Page,
    int PageSize);
