using Dizajno.Domain.Enums;

namespace Dizajno.Dto.Share;

public sealed record CreateShareRequest(
    ShareMode Mode,
    ShareKind Kind,
    string? InvitedEmail,
    DateTime? ExpiresAt);
