using Dizajno.Domain.Enums;

namespace Dizajno.Dto.Share;

public sealed record ShareSummaryDto(
    Guid Id,
    ShareMode Mode,
    string? Token,
    string? InvitedEmail,
    DateTime? ExpiresAt,
    DateTime CreatedAt,
    DateTime? RevokedAt);
