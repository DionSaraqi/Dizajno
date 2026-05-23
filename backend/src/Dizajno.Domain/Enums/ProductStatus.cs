namespace Dizajno.Domain.Enums;

public enum ProductStatus
{
    Draft = 0,
    Published = 1,
    Hidden = 2,
    Removed = 3,
    /// <summary>
    /// Awaiting admin moderation. Set on every new product from an untrusted
    /// supplier (Supplier.IsTrusted = false). Cleared to Published on approve
    /// or Hidden on reject. Editing a Published product never re-triggers this
    /// state — only the initial publish does.
    /// </summary>
    Pending = 4
}
