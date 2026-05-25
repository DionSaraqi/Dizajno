using System.Security.Claims;
using System.Text.RegularExpressions;
using Dizajno.Application.Interfaces;
using Dizajno.Data;
using Dizajno.Domain.Entities;
using Dizajno.Domain.Enums;
using Dizajno.Dto.Supplier;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dizajno.Application.Services;

public sealed class SupplierCategoryService : ISupplierCategoryService
{
    private static readonly Regex NonSlugChars = new("[^a-z0-9-]", RegexOptions.Compiled);

    private readonly DizajnoDbContext _db;
    private readonly ISupplierMembershipResolver _memberships;
    private readonly IAuditLogger _audit;

    public SupplierCategoryService(
        DizajnoDbContext db, ISupplierMembershipResolver memberships, IAuditLogger audit)
    {
        _db = db;
        _memberships = memberships;
        _audit = audit;
    }

    public async Task<ActionResult<IReadOnlyList<SuggestedCategoryDto>>> ListAsync(
        ClaimsPrincipal user,
        Guid? supplierId,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);
        var supplierIds = memberships.ActiveSupplierIds();
        if (supplierIds.Count == 0) return new ForbidResult();
        if (supplierId is { } target)
        {
            if (!supplierIds.Contains(target)) return new ForbidResult();
            supplierIds = new HashSet<Guid> { target };
        }

        var rows = await _db.Categories
            .AsNoTracking()
            .Where(c => c.SuggestedBySupplierId != null && supplierIds.Contains(c.SuggestedBySupplierId!.Value))
            .OrderByDescending(c => c.Status == CategoryStatus.Pending)
            .ThenBy(c => c.Name)
            .Select(c => new SuggestedCategoryDto(
                c.Id, c.Family, c.ParentCategoryId, c.Slug, c.Name, c.Path, c.Status, c.SuggestedBySupplierId))
            .ToListAsync(cancellationToken);
        return new OkObjectResult(rows);
    }

    public async Task<ActionResult<SuggestedCategoryDto>> SuggestAsync(
        SuggestCategoryRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);
        if (!memberships.IsActiveMemberOf(request.SupplierId)) return new ForbidResult();

        // Parent (if specified) must be in the same family AND already Approved â€”
        // can't nest a Pending suggestion under another Pending one.
        Category? parent = null;
        if (request.ParentCategoryId is { } pid)
        {
            parent = await _db.Categories.FirstOrDefaultAsync(c => c.Id == pid, cancellationToken);
            if (parent is null)
                return new ObjectResult(new ProblemDetails { Detail = "Parent category not found.", Status = StatusCodes.Status400BadRequest }) { StatusCode = StatusCodes.Status400BadRequest };
            if (parent.Family != request.Family)
                return new ObjectResult(new ProblemDetails { Detail = "Parent category is in a different family.", Status = StatusCodes.Status400BadRequest }) { StatusCode = StatusCodes.Status400BadRequest };
            if (parent.Status != CategoryStatus.Approved)
                return new ObjectResult(new ProblemDetails { Detail = "Parent category is not yet approved.", Status = StatusCodes.Status400BadRequest }) { StatusCode = StatusCodes.Status400BadRequest };
        }

        var slug = Slugify(request.Name);
        if (string.IsNullOrEmpty(slug))
            return new ObjectResult(new ProblemDetails { Detail = "Name does not produce a usable slug.", Status = StatusCodes.Status400BadRequest }) { StatusCode = StatusCodes.Status400BadRequest };
        if (await _db.Categories.AnyAsync(c => c.Family == request.Family && c.Slug == slug, cancellationToken))
            return new ObjectResult(new ProblemDetails { Detail = "A category with this name/slug already exists in this family.", Status = StatusCodes.Status409Conflict }) { StatusCode = StatusCodes.Status409Conflict };

        var path = parent is null
            ? $"/{request.Family.ToString().ToLowerInvariant()}/{slug}/"
            : $"{parent.Path}{slug}/";

        var category = new Category
        {
            Id = Guid.NewGuid(),
            Family = request.Family,
            ParentCategoryId = request.ParentCategoryId,
            Slug = slug,
            Name = request.Name.Trim(),
            Path = path,
            SortOrder = 100,                        // suggested rows sort below the seeded ones
            Status = CategoryStatus.Pending,
            SuggestedBySupplierId = request.SupplierId
        };
        _db.Categories.Add(category);
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(
            "category.suggest",
            nameof(Category),
            category.Id,
            new { category.Family, category.Name, suggestedBy = request.SupplierId },
            cancellationToken);

        return new ObjectResult(new SuggestedCategoryDto(
            category.Id, category.Family, category.ParentCategoryId, category.Slug, category.Name,
            category.Path, category.Status, category.SuggestedBySupplierId)) { StatusCode = StatusCodes.Status201Created };
    }

    private static string Slugify(string name)
    {
        var lower = name.Trim().ToLowerInvariant();
        var hyphenated = lower.Replace(' ', '-').Replace('_', '-');
        var cleaned = NonSlugChars.Replace(hyphenated, string.Empty);
        // Collapse repeated hyphens.
        while (cleaned.Contains("--", StringComparison.Ordinal))
            cleaned = cleaned.Replace("--", "-", StringComparison.Ordinal);
        return cleaned.Trim('-');
    }

    private static bool TryGetUserId(ClaimsPrincipal user, out Guid userId)
    {
        var raw = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value;
        return Guid.TryParse(raw, out userId);
    }
}
