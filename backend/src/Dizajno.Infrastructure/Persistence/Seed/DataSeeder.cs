using System.Text.Json;
using Dizajno.Application.Seed;
using Dizajno.Domain.Entities;
using Dizajno.Domain.Enums;
using Dizajno.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Dizajno.Infrastructure.Persistence.Seed;

public sealed class DataSeeder : IDataSeeder
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private static readonly string[] Roles = ["Admin", "User"];

    private readonly DizajnoDbContext _db;
    private readonly UserManager<ApplicationUser> _users;
    private readonly RoleManager<IdentityRole<Guid>> _roles;
    private readonly SeedOptions _options;
    private readonly ILogger<DataSeeder> _log;

    public DataSeeder(
        DizajnoDbContext db,
        UserManager<ApplicationUser> users,
        RoleManager<IdentityRole<Guid>> roles,
        IOptions<SeedOptions> options,
        ILogger<DataSeeder> log)
    {
        _db = db;
        _users = users;
        _roles = roles;
        _options = options.Value;
        _log = log;
    }

    public async Task SeedAsync(CancellationToken cancellationToken)
    {
        await SeedRolesAsync();
        await SeedAdminAsync();
        var supplier = await SeedSupplierAsync(cancellationToken);
        var categories = await SeedCategoriesAsync(cancellationToken);
        await SeedProductsAsync(supplier, categories, cancellationToken);
        await SeedTextureLibraryAsync(supplier, cancellationToken);
    }

    private async Task SeedRolesAsync()
    {
        foreach (var name in Roles)
        {
            if (!await _roles.RoleExistsAsync(name))
            {
                var result = await _roles.CreateAsync(new IdentityRole<Guid>(name)
                {
                    Id = Guid.NewGuid()
                });
                if (!result.Succeeded)
                {
                    throw new InvalidOperationException(
                        $"Failed to create role '{name}': {string.Join("; ", result.Errors.Select(e => e.Description))}");
                }
                _log.LogInformation("Seeded role {Role}", name);
            }
        }
    }

    private async Task SeedAdminAsync()
    {
        var existing = await _users.FindByEmailAsync(_options.AdminEmail);
        if (existing is not null)
        {
            return;
        }

        var admin = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = _options.AdminEmail,
            Email = _options.AdminEmail,
            EmailConfirmed = true,
            DisplayName = _options.AdminDisplayName,
            Locale = "sq",
            CreatedAt = DateTime.UtcNow
        };

        var result = await _users.CreateAsync(admin, _options.AdminPassword);
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                $"Failed to create seed admin: {string.Join("; ", result.Errors.Select(e => e.Description))}");
        }

        await _users.AddToRoleAsync(admin, "Admin");
        await _users.AddToRoleAsync(admin, "User");
        _log.LogInformation("Seeded admin user {Email}", _options.AdminEmail);
    }

    private async Task<Supplier> SeedSupplierAsync(CancellationToken cancellationToken)
    {
        var supplier = await _db.Suppliers
            .FirstOrDefaultAsync(s => s.Slug == "dizajno", cancellationToken);
        if (supplier is not null)
        {
            return supplier;
        }

        supplier = new Supplier
        {
            Id = Guid.NewGuid(),
            Slug = "dizajno",
            Name = "Dizajno",
            Description = "First-party seed catalog. Replaced by real suppliers once the supplier portal ships.",
            CreatedAt = DateTime.UtcNow
        };
        _db.Suppliers.Add(supplier);
        await _db.SaveChangesAsync(cancellationToken);
        _log.LogInformation("Seeded supplier 'dizajno'");
        return supplier;
    }

    /// <summary>
    /// Upserts every <see cref="CatalogSeedData.Categories"/> row. Categories are
    /// scoped per <see cref="ProductFamily"/> so the same name can legitimately exist
    /// in multiple families if needed; the returned dictionary is keyed on the
    /// combined (Family, Name) tuple to disambiguate during product seeding.
    /// </summary>
    private async Task<Dictionary<(ProductFamily Family, string Name), Category>> SeedCategoriesAsync(
        CancellationToken cancellationToken)
    {
        var existing = await _db.Categories
            .ToDictionaryAsync(c => (c.Family, c.Name), cancellationToken);

        var added = 0;
        foreach (var seed in CatalogSeedData.Categories)
        {
            var key = (seed.Family, seed.Name);
            if (existing.ContainsKey(key))
            {
                continue;
            }

            var slug = seed.Name.ToLowerInvariant().Replace(' ', '-');
            var family = seed.Family;
            var category = new Category
            {
                Id = Guid.NewGuid(),
                Family = family,
                Slug = slug,
                Name = seed.Name,
                Path = $"/{family.ToString().ToLowerInvariant()}/{slug}/",
                SortOrder = 0
            };
            _db.Categories.Add(category);
            existing[key] = category;
            added++;
        }

        if (added > 0)
        {
            await _db.SaveChangesAsync(cancellationToken);
            _log.LogInformation("Seeded {Count} catalog categories", added);
        }
        return existing;
    }

    private async Task SeedProductsAsync(
        Supplier supplier,
        Dictionary<(ProductFamily Family, string Name), Category> categoriesByKey,
        CancellationToken cancellationToken)
    {
        var existingSlugs = await _db.Products
            .Select(p => p.Slug)
            .ToListAsync(cancellationToken);
        var existing = new HashSet<string>(existingSlugs, StringComparer.Ordinal);

        var added = 0;
        foreach (var seed in CatalogSeedData.Items)
        {
            if (existing.Contains(seed.Type))
            {
                continue;
            }

            if (!categoriesByKey.TryGetValue((seed.Family, seed.Category), out var category))
            {
                throw new InvalidOperationException(
                    $"Seed product '{seed.Type}' references unknown category " +
                    $"'{seed.Category}' under family {seed.Family}.");
            }

            var productId = Guid.NewGuid();
            var now = DateTime.UtcNow;

            var product = new Product
            {
                Id = productId,
                SupplierId = supplier.Id,
                Family = seed.Family,
                CategoryId = category.Id,
                Slug = seed.Type,
                Status = ProductStatus.Published,
                UnitOfSale = seed.UnitOfSale,
                CoverageRate = seed.CoverageRate,
                WasteFactor = seed.WasteFactor,
                Name = seed.Label,
                PreviewSvg = seed.SvgPreview,
                Attributes = JsonSerializer.Serialize(new { icon = seed.Icon }, JsonOpts),
                CreatedAt = now,
                UpdatedAt = now
            };
            _db.Products.Add(product);

            Asset? glbAsset = null;
            if (seed.ModelUrl is not null)
            {
                glbAsset = new Asset
                {
                    Id = Guid.NewGuid(),
                    ProductId = productId,
                    Kind = AssetKind.Glb,
                    Url = seed.ModelUrl,
                    MimeType = "model/gltf-binary",
                    SizeBytes = 0,
                    SortOrder = 0,
                    CreatedAt = now
                };
                _db.Assets.Add(glbAsset);
            }

            var variant = new ProductVariant
            {
                Id = Guid.NewGuid(),
                ProductId = productId,
                Sku = $"{seed.Type}-default",
                Name = "Default",
                Width = seed.Width,
                Depth = seed.Depth,
                Height = seed.Height,
                Color = seed.Color,
                Currency = "EUR",
                GlbAssetId = glbAsset?.Id,
                CollisionBoxes = seed.CollisionBoxes is null
                    ? null
                    : JsonSerializer.Serialize(seed.CollisionBoxes, JsonOpts),
                MaterialDefaults = seed.MaterialSlots is null
                    ? null
                    : JsonSerializer.Serialize(seed.MaterialSlots, JsonOpts),
                Attributes = "{}",
                SortOrder = 0,
                CreatedAt = now,
                UpdatedAt = now
            };
            _db.ProductVariants.Add(variant);

            added++;
        }

        if (added > 0)
        {
            await _db.SaveChangesAsync(cancellationToken);
            _log.LogInformation("Seeded {Count} furniture products", added);
        }
    }

    /// <summary>
    /// Materialises the per-variant texture options declared in
    /// <see cref="CatalogSeedData.Items"/> as proper relational rows:
    /// one <see cref="Asset"/> + <see cref="SupplierTexture"/> per distinct URL
    /// under the seed supplier, then a <see cref="ProductVariantTextureSlot"/>
    /// for each (variant, slot, url) tuple. Empty-string entries in the seed
    /// represent the implicit "None" option and are skipped — the catalog DTO
    /// re-prepends them when serving the slot list.
    /// </summary>
    private async Task SeedTextureLibraryAsync(Supplier supplier, CancellationToken cancellationToken)
    {
        // 1. Gather distinct (url, displayName) pairs across all items.
        var library = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var item in CatalogSeedData.Items)
        {
            if (item.TextureSlots is null) continue;
            foreach (var urls in item.TextureSlots.Values)
            {
                foreach (var url in urls)
                {
                    if (string.IsNullOrWhiteSpace(url)) continue;
                    if (library.ContainsKey(url)) continue;
                    library[url] = DeriveTextureName(url);
                }
            }
        }

        if (library.Count == 0)
        {
            return;
        }

        // 2. Upsert SupplierTexture rows (and their backing Asset) keyed by name.
        var existingTextures = await _db.SupplierTextures
            .Where(t => t.SupplierId == supplier.Id)
            .ToDictionaryAsync(t => t.Name, cancellationToken);

        var textureIdByUrl = new Dictionary<string, Guid>(StringComparer.Ordinal);
        var newTextures = 0;
        var now = DateTime.UtcNow;
        foreach (var (url, name) in library)
        {
            if (existingTextures.TryGetValue(name, out var existing))
            {
                textureIdByUrl[url] = existing.Id;
                continue;
            }

            var assetId = Guid.NewGuid();
            _db.Assets.Add(new Asset
            {
                Id = assetId,
                OwnerSupplierId = supplier.Id,
                Kind = AssetKind.Image,
                Url = url,
                MimeType = GuessMimeType(url),
                SizeBytes = 0,
                SortOrder = 0,
                CreatedAt = now
            });

            var textureId = Guid.NewGuid();
            _db.SupplierTextures.Add(new SupplierTexture
            {
                Id = textureId,
                SupplierId = supplier.Id,
                Name = name,
                AssetId = assetId,
                Tags = Array.Empty<string>(),
                RepeatU = 4,
                RepeatV = 4,
                CreatedAt = now
            });
            textureIdByUrl[url] = textureId;
            newTextures++;
        }

        if (newTextures > 0)
        {
            await _db.SaveChangesAsync(cancellationToken);
            _log.LogInformation("Seeded {Count} supplier textures", newTextures);
        }

        // 3. For each seeded item with TextureSlots, ensure the matching variant
        // has ProductVariantTextureSlot rows. The first non-empty URL per slot is
        // marked IsDefault.
        var newSlots = 0;
        foreach (var item in CatalogSeedData.Items)
        {
            if (item.TextureSlots is null) continue;

            var sku = $"{item.Type}-default";
            var variantId = await _db.ProductVariants
                .Where(v => v.Sku == sku)
                .Select(v => v.Id)
                .FirstOrDefaultAsync(cancellationToken);
            if (variantId == Guid.Empty) continue;

            var hasAnySlot = await _db.ProductVariantTextureSlots
                .AnyAsync(s => s.VariantId == variantId, cancellationToken);
            if (hasAnySlot) continue;

            foreach (var (slotName, urls) in item.TextureSlots)
            {
                var defaultAssigned = false;
                foreach (var url in urls)
                {
                    if (string.IsNullOrWhiteSpace(url)) continue;
                    if (!textureIdByUrl.TryGetValue(url, out var textureId)) continue;

                    _db.ProductVariantTextureSlots.Add(new ProductVariantTextureSlot
                    {
                        Id = Guid.NewGuid(),
                        VariantId = variantId,
                        SlotName = slotName,
                        SupplierTextureId = textureId,
                        IsDefault = !defaultAssigned
                    });
                    defaultAssigned = true;
                    newSlots++;
                }
            }
        }

        if (newSlots > 0)
        {
            await _db.SaveChangesAsync(cancellationToken);
            _log.LogInformation("Seeded {Count} product-variant texture slots", newSlots);
        }
    }

    private static string DeriveTextureName(string url)
    {
        var basename = url.Split('/').Last();
        var withoutExt = basename.Contains('.') ? basename[..basename.LastIndexOf('.')] : basename;
        var pretty = withoutExt.Replace('-', ' ').Replace('_', ' ').Trim();
        if (pretty.Length == 0) return basename;
        return string.Join(' ', pretty.Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Select(word => char.ToUpperInvariant(word[0]) + word[1..]));
    }

    private static string GuessMimeType(string url)
    {
        var dot = url.LastIndexOf('.');
        if (dot < 0) return "application/octet-stream";
        return url[(dot + 1)..].ToLowerInvariant() switch
        {
            "jpg" or "jpeg" => "image/jpeg",
            "png" => "image/png",
            "webp" => "image/webp",
            _ => "application/octet-stream"
        };
    }
}
