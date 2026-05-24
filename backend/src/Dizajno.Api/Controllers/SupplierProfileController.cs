using System.Security.Claims;
using Dizajno.Api.Contracts;
using Dizajno.Application.Audit;
using Dizajno.Application.Suppliers;
using Dizajno.Domain.Entities;
using Dizajno.Domain.Enums;
using Dizajno.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dizajno.Api.Controllers;

/// <summary>
/// Phase 7b — Owner-only supplier profile edit. Slug is immutable (URL
/// stability + audit-log entity-id stays useful). IsTrusted + SuspendedAt are
/// admin-only flips and stay outside this endpoint's surface.
/// </summary>
[ApiController]
[Route("api/supplier/profile")]
[Authorize]
public sealed class SupplierProfileController : ControllerBase
{
    private readonly DizajnoDbContext _db;
    private readonly ISupplierMembershipResolver _memberships;
    private readonly IAuditLogger _audit;

    public SupplierProfileController(
        DizajnoDbContext db, ISupplierMembershipResolver memberships, IAuditLogger audit)
    {
        _db = db;
        _memberships = memberships;
        _audit = audit;
    }

    [HttpGet("{supplierId:guid}")]
    public async Task<ActionResult<SupplierProfileDto>> Get(Guid supplierId, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);
        if (!memberships.IsActiveMemberOf(supplierId)) return Forbid();

        var dto = await _db.Suppliers
            .AsNoTracking()
            .Where(s => s.Id == supplierId)
            .Select(s => new SupplierProfileDto(
                s.Id, s.Slug, s.Name, s.Description, s.WebsiteUrl, s.ContactEmail, s.ContactPhone,
                s.LogoAssetId, s.LogoAsset != null ? s.LogoAsset.Url : null,
                s.IsTrusted, s.SuspendedAt))
            .FirstOrDefaultAsync(cancellationToken);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPut("{supplierId:guid}")]
    public async Task<ActionResult<SupplierProfileDto>> Update(
        Guid supplierId, UpdateProfileRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);
        if (!memberships.IsActiveOwnerOf(supplierId)) return Forbid();

        var supplier = await _db.Suppliers.FirstOrDefaultAsync(s => s.Id == supplierId, cancellationToken);
        if (supplier is null) return NotFound();

        if (request.LogoAssetId is { } lid)
        {
            var logoOk = await _db.Assets.AnyAsync(
                a => a.Id == lid && a.OwnerSupplierId == supplierId && a.Kind == AssetKind.Image,
                cancellationToken);
            if (!logoOk)
                return Problem("Logo asset not found or belongs to a different supplier.",
                    statusCode: StatusCodes.Status400BadRequest);
        }

        var before = new { supplier.Name, supplier.Description, supplier.WebsiteUrl, supplier.ContactEmail, supplier.ContactPhone, supplier.LogoAssetId };
        supplier.Name = request.Name.Trim();
        supplier.Description = request.Description;
        supplier.WebsiteUrl = request.WebsiteUrl;
        supplier.ContactEmail = request.ContactEmail;
        supplier.ContactPhone = request.ContactPhone;
        supplier.LogoAssetId = request.LogoAssetId;
        await _db.SaveChangesAsync(cancellationToken);
        await _audit.LogAsync(
            "supplier.profile_update",
            nameof(Supplier),
            supplier.Id,
            new
            {
                before,
                after = new { supplier.Name, supplier.Description, supplier.WebsiteUrl, supplier.ContactEmail, supplier.ContactPhone, supplier.LogoAssetId }
            },
            cancellationToken);

        var dto = await _db.Suppliers
            .AsNoTracking()
            .Where(s => s.Id == supplierId)
            .Select(s => new SupplierProfileDto(
                s.Id, s.Slug, s.Name, s.Description, s.WebsiteUrl, s.ContactEmail, s.ContactPhone,
                s.LogoAssetId, s.LogoAsset != null ? s.LogoAsset.Url : null,
                s.IsTrusted, s.SuspendedAt))
            .FirstAsync(cancellationToken);
        return Ok(dto);
    }

    private bool TryGetUserId(out Guid userId)
    {
        var raw = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
        return Guid.TryParse(raw, out userId);
    }
}
