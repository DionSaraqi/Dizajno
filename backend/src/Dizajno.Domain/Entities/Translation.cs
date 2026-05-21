namespace Dizajno.Domain.Entities;

/// <summary>
/// Non-default-language overlay. The entity itself carries the default-language text
/// (Albanian). Translations only hold rows for additional languages (e.g. English).
/// </summary>
public sealed class Translation
{
    public Guid Id { get; set; }
    /// <summary>Logical entity name: "Product", "ProductVariant", "Category", "Supplier".</summary>
    public string EntityType { get; set; } = string.Empty;
    public Guid EntityId { get; set; }
    /// <summary>Property being translated: "Name", "Description".</summary>
    public string Field { get; set; } = string.Empty;
    /// <summary>ISO 639-1 language code (e.g. "en"). Default language ("sq") lives on the entity.</summary>
    public string Lang { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
}
