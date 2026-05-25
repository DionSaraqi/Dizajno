using Dizajno.Domain.Enums;

namespace Dizajno.Dto.Admin;

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
