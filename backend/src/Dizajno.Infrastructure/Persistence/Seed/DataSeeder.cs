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

    private async Task<Dictionary<string, Category>> SeedCategoriesAsync(CancellationToken cancellationToken)
    {
        var existing = await _db.Categories
            .Where(c => c.Family == ProductFamily.Furniture)
            .ToDictionaryAsync(c => c.Name, cancellationToken);

        foreach (var name in CatalogSeedData.Categories)
        {
            if (existing.ContainsKey(name))
            {
                continue;
            }

            var slug = name.ToLowerInvariant();
            var category = new Category
            {
                Id = Guid.NewGuid(),
                Family = ProductFamily.Furniture,
                Slug = slug,
                Name = name,
                Path = $"/{slug}/",
                SortOrder = 0
            };
            _db.Categories.Add(category);
            existing[name] = category;
        }

        await _db.SaveChangesAsync(cancellationToken);
        _log.LogInformation("Seeded {Count} furniture categories", existing.Count);
        return existing;
    }

    private async Task SeedProductsAsync(
        Supplier supplier,
        Dictionary<string, Category> categoriesByName,
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

            if (!categoriesByName.TryGetValue(seed.Category, out var category))
            {
                throw new InvalidOperationException(
                    $"Seed product '{seed.Type}' references unknown category '{seed.Category}'.");
            }

            var productId = Guid.NewGuid();
            var now = DateTime.UtcNow;

            var product = new Product
            {
                Id = productId,
                SupplierId = supplier.Id,
                Family = ProductFamily.Furniture,
                CategoryId = category.Id,
                Slug = seed.Type,
                Status = ProductStatus.Published,
                UnitOfSale = UnitOfSale.Piece,
                WasteFactor = 0,
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
                Attributes = seed.TextureSlots is null
                    ? "{}"
                    : JsonSerializer.Serialize(new { textureSlots = seed.TextureSlots }, JsonOpts),
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
}
