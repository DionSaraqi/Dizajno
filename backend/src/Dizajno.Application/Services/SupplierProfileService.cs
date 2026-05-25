using System.Security.Claims;
using Dizajno.Application.Interfaces;
using Dizajno.Data;
using Dizajno.Domain.Entities;
using Dizajno.Domain.Enums;
using Dizajno.Dto.Supplier;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Dizajno.Application.Services;

public sealed class SupplierProfileService : ISupplierProfileService
{
    private readonly DizajnoDbContext _db;
    private readonly ISupplierMembershipResolver _memberships;
    private readonly IAuditLogger _audit;

    public SupplierProfileService(
        DizajnoDbContext db, ISupplierMembershipResolver memberships, IAuditLogger audit)
    {
        _db = db;
        _memberships = memberships;
        _audit = audit;
    }

    public async Task<ActionResult<SupplierProfileDto>> GetAsync(
        Guid supplierId,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);
        if (!memberships.IsActiveMemberOf(supplierId)) return new ForbidResult();

        var dto = await _db.Suppliers
            .AsNoTracking()
            .Where(s => s.Id == supplierId)
            .Select(s => new SupplierProfileDto(
                s.Id, s.Slug, s.Name, s.Description, s.WebsiteUrl, s.ContactEmail, s.ContactPhone,
                s.LogoAssetId, s.LogoAsset != null ? s.LogoAsset.Url : null,
                s.IsTrusted, s.SuspendedAt))
            .FirstOrDefaultAsync(cancellationToken);
        return dto is null ? new NotFoundResult() : new OkObjectResult(dto);
    }

    public async Task<ActionResult<SupplierProfileDto>> UpdateAsync(
        Guid supplierId,
        UpdateProfileRequest request,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var userId)) return new UnauthorizedResult();
        var memberships = await _memberships.GetMembershipsAsync(userId, cancellationToken);
        if (!memberships.IsActiveOwnerOf(supplierId)) return new ForbidResult();

        var supplier = await _db.Suppliers.FirstOrDefaultAsync(s => s.Id == supplierId, cancellationToken);
        if (supplier is null) return new NotFoundResult();

        if (request.LogoAssetId is { } lid)
        {
            var logoOk = await _db.Assets.AnyAsync(
                a => a.Id == lid && a.OwnerSupplierId == supplierId && a.Kind == AssetKind.Image,
                cancellationToken);
            if (!logoOk)
                return new ObjectResult(new ProblemDetails { Detail = "Logo asset not found or belongs to a different supplier.", Status = StatusCodes.Status400BadRequest }) { StatusCode = StatusCodes.Status400BadRequest };
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
        return new OkObjectResult(dto);
    }

    private static bool TryGetUserId(ClaimsPrincipal user, out Guid userId)
    {
        var raw = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value;
        return Guid.TryParse(raw, out userId);
    }
}
