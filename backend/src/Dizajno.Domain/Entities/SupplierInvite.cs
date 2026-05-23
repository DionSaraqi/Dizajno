using Dizajno.Domain.Enums;

namespace Dizajno.Domain.Entities;

/// <summary>
/// Admin-issued invitation for a user to join a supplier as a member.
/// Created by admin via <c>POST /api/admin/suppliers/{id}/invites</c>; the
/// admin gets a tokenized URL back and forwards it out-of-band (Slack,
/// WhatsApp, email — whatever's handy). Invitee opens <c>/invite/{token}</c>,
/// logs in or registers, and the accept endpoint inserts a
/// <see cref="SupplierMember"/> row binding them.
/// </summary>
public sealed class SupplierInvite
{
    public Guid Id { get; set; }
    public Guid SupplierId { get; set; }
    public SupplierMemberRole Role { get; set; } = SupplierMemberRole.Staff;
    /// <summary>Label only — not used for delivery. Admin types in whatever helps them remember who the token went to.</summary>
    public string InvitedEmail { get; set; } = string.Empty;
    /// <summary>32-byte base64url random token. The DB only ever sees the SHA-256 hash via <see cref="TokenHash"/>; the raw token is returned exactly once from create and never persisted in plaintext.</summary>
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime? AcceptedAt { get; set; }
    public Guid? AcceptedByUserId { get; set; }
    public DateTime? RevokedAt { get; set; }
    public Guid CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }

    public Supplier Supplier { get; set; } = null!;
}
