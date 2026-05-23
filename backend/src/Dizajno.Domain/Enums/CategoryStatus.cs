namespace Dizajno.Domain.Enums;

/// <summary>
/// Suppliers can suggest new categories under the five hard-coded families;
/// admin must approve before they appear on the public catalog. Existing
/// admin/seeded categories are Approved by default.
/// </summary>
public enum CategoryStatus
{
    Pending = 0,
    Approved = 1
}
