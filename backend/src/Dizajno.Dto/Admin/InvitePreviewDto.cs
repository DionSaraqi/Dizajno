using Dizajno.Domain.Enums;

namespace Dizajno.Dto.Admin;

public sealed record InvitePreviewDto(
    string SupplierName,
    string SupplierSlug,
    SupplierMemberRole Role,
    string InvitedEmail,
    DateTime ExpiresAt,
    bool IsExpired,
    bool IsAccepted,
    bool IsRevoked);
