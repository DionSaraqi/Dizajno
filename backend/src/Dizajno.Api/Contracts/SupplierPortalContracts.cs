using System.ComponentModel.DataAnnotations;
using Dizajno.Domain.Enums;

namespace Dizajno.Api.Contracts;

// ══════════════════════════════════════════════════════════════════════════
// Phase 7b — supplier portal contracts
// ══════════════════════════════════════════════════════════════════════════

// ── Products ──────────────────────────────────────────────────────────────

/// <summary>
/// Row in a supplier's own product list. Includes Draft/Pending/Hidden/Removed
/// in addition to Published — suppliers see their entire catalog regardless
/// of public visibility.
/// </summary>
public sealed record SupplierProductSummaryDto(
    Guid Id,
    string Slug,
    string Name,
    string Family,
    Guid CategoryId,
    string CategoryName,
    ProductStatus Status,
    string UnitOfSale,
    decimal? BasePrice,
    string Currency,
    int VariantCount,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record SupplierProductDetailDto(
    Guid Id,
    Guid SupplierId,
    string Slug,
    string Name,
    string Family,
    Guid CategoryId,
    string CategoryName,
    ProductStatus Status,
    string UnitOfSale,
    decimal? CoverageRate,
    decimal WasteFactor,
    int? LeadTimeDays,
    string? Description,
    string? PreviewSvg,
    string? TextureUrl,
    string Attributes,
    IReadOnlyList<SupplierVariantDto> Variants,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record CreateProductRequest(
    [Required] Guid SupplierId,
    [Required] ProductFamily Family,
    [Required] Guid CategoryId,
    [Required, MaxLength(160)] string Slug,
    [Required, MaxLength(200)] string Name,
    string? Description,
    UnitOfSale UnitOfSale,
    decimal? CoverageRate,
    decimal WasteFactor,
    int? LeadTimeDays,
    string? PreviewSvg,
    string? TextureUrl,
    /// <summary>jsonb-shaped attributes (icon, lumen, energyClass, ...). Free-form per family.</summary>
    string? Attributes);

public sealed record UpdateProductRequest(
    [Required] Guid CategoryId,
    [Required, MaxLength(200)] string Name,
    string? Description,
    UnitOfSale UnitOfSale,
    decimal? CoverageRate,
    decimal WasteFactor,
    int? LeadTimeDays,
    string? PreviewSvg,
    string? TextureUrl,
    string? Attributes);

// ── Variants ──────────────────────────────────────────────────────────────

public sealed record SupplierVariantDto(
    Guid Id,
    Guid ProductId,
    string Sku,
    string Name,
    decimal Width,
    decimal Depth,
    decimal Height,
    string Color,
    decimal? BasePrice,
    string Currency,
    Guid? GlbAssetId,
    string? GlbAssetUrl,
    Guid? SvgPreviewAssetId,
    string? SvgPreviewAssetUrl,
    /// <summary>jsonb: [{ offsetX, offsetZ, width, depth }, ...]. Null = single-AABB from width×depth.</summary>
    string? CollisionBoxes,
    /// <summary>jsonb: {slotName: hexColor}. Drives the customizer's per-slot color pickers.</summary>
    string? MaterialDefaults,
    string Attributes,
    int SortOrder,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record CreateVariantRequest(
    [Required, MaxLength(120)] string Sku,
    [Required, MaxLength(200)] string Name,
    [Range(0.01, 50)] decimal Width,
    [Range(0.01, 50)] decimal Depth,
    [Range(0.01, 50)] decimal Height,
    [MaxLength(16)] string Color,
    decimal? BasePrice,
    [MaxLength(3)] string Currency,
    string? CollisionBoxes,
    string? MaterialDefaults,
    string? Attributes,
    int? SortOrder);

public sealed record UpdateVariantRequest(
    [Required, MaxLength(200)] string Name,
    [Range(0.01, 50)] decimal Width,
    [Range(0.01, 50)] decimal Depth,
    [Range(0.01, 50)] decimal Height,
    [MaxLength(16)] string Color,
    decimal? BasePrice,
    [MaxLength(3)] string Currency,
    string? CollisionBoxes,
    string? MaterialDefaults,
    string? Attributes,
    int? SortOrder);

public sealed record AttachVariantAssetRequest(
    [Required] Guid AssetId);

// ── Textures ──────────────────────────────────────────────────────────────

public sealed record SupplierTextureDto(
    Guid Id,
    Guid SupplierId,
    string Name,
    Guid AssetId,
    string AssetUrl,
    Guid? ThumbnailAssetId,
    string? ThumbnailAssetUrl,
    IReadOnlyList<string> Tags,
    int RepeatU,
    int RepeatV,
    int SlotBindingCount,
    DateTime CreatedAt);

public sealed record CreateTextureRequest(
    [Required] Guid SupplierId,
    [Required, MaxLength(200)] string Name,
    [Required] Guid AssetId,
    Guid? ThumbnailAssetId,
    IReadOnlyList<string>? Tags,
    int? RepeatU,
    int? RepeatV);

public sealed record UpdateTextureRequest(
    [Required, MaxLength(200)] string Name,
    Guid? ThumbnailAssetId,
    IReadOnlyList<string>? Tags,
    int? RepeatU,
    int? RepeatV);

/// <summary>One row in a variant's texture-slot binding table.</summary>
public sealed record VariantTextureSlotInput(
    [Required, MaxLength(120)] string SlotName,
    [Required] Guid SupplierTextureId,
    bool IsDefault);

/// <summary>
/// Full replacement of a variant's texture slot bindings. The handler deletes
/// existing rows and inserts the supplied ones in one transaction, which is
/// simpler than computing a diff and matches the supplier UX (edit-and-save
/// the whole table). Every <see cref="VariantTextureSlotInput.SupplierTextureId"/>
/// must belong to the variant's product's supplier — DB trigger enforces this
/// too, but the controller fails fast with a 400.
/// </summary>
public sealed record ReplaceVariantTextureSlotsRequest(
    [Required] IReadOnlyList<VariantTextureSlotInput> Slots);

public sealed record VariantTextureSlotDto(
    Guid Id,
    Guid VariantId,
    string SlotName,
    Guid SupplierTextureId,
    string SupplierTextureName,
    string AssetUrl,
    bool IsDefault);

// ── Categories (supplier-suggested) ───────────────────────────────────────

public sealed record SuggestCategoryRequest(
    [Required] Guid SupplierId,
    [Required] ProductFamily Family,
    Guid? ParentCategoryId,
    [Required, MaxLength(200)] string Name);

public sealed record SuggestedCategoryDto(
    Guid Id,
    ProductFamily Family,
    Guid? ParentCategoryId,
    string Slug,
    string Name,
    string Path,
    CategoryStatus Status,
    Guid? SuggestedBySupplierId);

// ── Members (Owner-only management) ───────────────────────────────────────

public sealed record SupplierMemberSummaryDto(
    Guid Id,
    Guid SupplierId,
    Guid UserId,
    string UserEmail,
    string? UserDisplayName,
    SupplierMemberRole Role,
    DateTime CreatedAt);

public sealed record ChangeMemberRoleRequest(
    [Required] SupplierMemberRole Role);

// ── Profile (Owner-only) ──────────────────────────────────────────────────

public sealed record SupplierProfileDto(
    Guid Id,
    string Slug,
    string Name,
    string? Description,
    string? WebsiteUrl,
    string? ContactEmail,
    string? ContactPhone,
    Guid? LogoAssetId,
    string? LogoAssetUrl,
    bool IsTrusted,
    DateTime? SuspendedAt);

public sealed record UpdateProfileRequest(
    [Required, MaxLength(200)] string Name,
    string? Description,
    [MaxLength(500)] string? WebsiteUrl,
    [EmailAddress, MaxLength(320)] string? ContactEmail,
    [MaxLength(50)] string? ContactPhone,
    Guid? LogoAssetId);
