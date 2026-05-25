using System.Security.Claims;
using System.Text.RegularExpressions;
using Dizajno.Dto.Admin;
using Dizajno.Dto.Asset;
using Dizajno.Dto.Auth;
using Dizajno.Dto.Catalog;
using Dizajno.Dto.Project;
using Dizajno.Dto.Quote;
using Dizajno.Dto.Share;
using Dizajno.Dto.Supplier;
using Dizajno.Application.Interfaces;
using Dizajno.Domain.Entities;
using Dizajno.Domain.Enums;
using Dizajno.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dizajno.Api.Controllers;

/// <summary>
/// Phase 7b â€” supplier-side category suggestions. Suppliers can propose a new
/// taxonomy entry under one of the five hard-coded <see cref="ProductFamily"/>
/// values; the row lands in <see cref="CategoryStatus.Pending"/> with
/// <see cref="Category.SuggestedBySupplierId"/> populated, and the admin
/// moderation queue (Phase 7a) approves or rejects.
///
/// Suppliers cannot edit or delete suggested categories from here â€” once
/// submitted, admin owns the lifecycle. The supplier just sees the row in
/// their portal until it flips to Approved.
/// </summary>
[ApiController]
[Route("api/supplier/categories")]
[Authorize]
public sealed class SupplierCategoriesController : ControllerBase
{
    private static readonly Regex NonSlugChars = new("[^a-z0-9-]", RegexOptions.Compiled);

    private readonly DizajnoDbContext _db;
    private readonly ISupplierMembershipResolver _memberships;
    private readonly IAuditLogger _audit;

    public SupplierCategoriesController(
        DizajnoDbContext db, ISupplierMembershipResolver memberships, IAuditLogger audit)
    {
        _db = db;
        _memberships = memberships;
        _audit = audit;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SuggestedCategoryDto>>> List(
        CancellationToken cancellationToken,
        [FromQuery] Guid? supplierId = null)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);
        var supplierIds = memberships.ActiveSupplierIds();
        if (supplierIds.Count == 0) return Forbid();
        if (supplierId is { } target)
        {
            if (!supplierIds.Contains(target)) return Forbid();
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
        return Ok(rows);
    }

    [HttpPost]
    public async Task<ActionResult<SuggestedCategoryDto>> Suggest(
        SuggestCategoryRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);
        if (!memberships.IsActiveMemberOf(request.SupplierId)) return Forbid();

        // Parent (if specified) must be in the same family AND already Approved â€”
        // can't nest a Pending suggestion under another Pending one.
        Category? parent = null;
        if (request.ParentCategoryId is { } pid)
        {
            parent = await _db.Categories.FirstOrDefaultAsync(c => c.Id == pid, cancellationToken);
            if (parent is null)
                return Problem("Parent category not found.", statusCode: StatusCodes.Status400BadRequest);
            if (parent.Family != request.Family)
                return Problem("Parent category is in a different family.", statusCode: StatusCodes.Status400BadRequest);
            if (parent.Status != CategoryStatus.Approved)
                return Problem("Parent category is not yet approved.", statusCode: StatusCodes.Status400BadRequest);
        }

        var slug = Slugify(request.Name);
        if (string.IsNullOrEmpty(slug))
            return Problem("Name does not produce a usable slug.", statusCode: StatusCodes.Status400BadRequest);
        if (await _db.Categories.AnyAsync(c => c.Family == request.Family && c.Slug == slug, cancellationToken))
            return Problem("A category with this name/slug already exists in this family.",
                statusCode: StatusCodes.Status409Conflict);

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

        return StatusCode(StatusCodes.Status201Created, new SuggestedCategoryDto(
            category.Id, category.Family, category.ParentCategoryId, category.Slug, category.Name,
            category.Path, category.Status, category.SuggestedBySupplierId));
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

    private bool TryGetUserId(out Guid userId)
    {
        var raw = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(raw, out userId);
    }
}