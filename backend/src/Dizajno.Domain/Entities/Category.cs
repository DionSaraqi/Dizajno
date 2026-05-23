using Dizajno.Domain.Enums;

namespace Dizajno.Domain.Entities;

public sealed class Category
{
    public Guid Id { get; set; }
    public ProductFamily Family { get; set; }
    public Guid? ParentCategoryId { get; set; }
    public string Slug { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    /// <summary>
    /// Materialized path like '/furniture/seating/sofas/' for prefix subtree queries.
    /// </summary>
    public string Path { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public CategoryStatus Status { get; set; } = CategoryStatus.Approved;
    /// <summary>Supplier that suggested this category. Null for admin/seed categories.</summary>
    public Guid? SuggestedBySupplierId { get; set; }

    public Category? ParentCategory { get; set; }
    public ICollection<Category> Children { get; set; } = new List<Category>();
}
