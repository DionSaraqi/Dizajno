using Dizajno.Domain.Enums;

namespace Dizajno.Infrastructure.Persistence.Seed;

/// <summary>
/// Initial catalog data mirroring frontend/src/utils/furnitureCatalog.ts.
/// Kept here as code (not JSON) so the SVG strings stay diff-friendly and reviewable.
/// Phase 7 (admin tooling + supplier portal) will deprecate this file in favor of
/// admin-uploaded products. Phase 4 promoted TextureSlots from a jsonb stash
/// on ProductVariant.Attributes to relational SupplierTexture + ProductVariantTextureSlot
/// rows. Phase 6 introduced the Family/UnitOfSale/CoverageRate/WasteFactor fields so
/// fixtures (doors/windows) and building materials (paint/flooring) can be seeded
/// alongside furniture; the dictionary here is still the source of truth for what
/// the seeder creates.
/// </summary>
public static class CatalogSeedData
{
    public sealed record CollisionBoxSeed(decimal OffsetX, decimal OffsetZ, decimal Width, decimal Depth);

    public sealed record CategorySeed(string Name, ProductFamily Family);

    public sealed record ItemSeed(
        string Type,
        string Label,
        decimal Width,
        decimal Depth,
        decimal Height,
        string Color,
        string Icon,
        string Category,
        string SvgPreview,
        ProductFamily Family = ProductFamily.Furniture,
        UnitOfSale UnitOfSale = UnitOfSale.Piece,
        decimal? CoverageRate = null,
        decimal WasteFactor = 0m,
        decimal? BasePrice = null,
        string? TextureUrl = null,
        string? ModelUrl = null,
        IReadOnlyList<CollisionBoxSeed>? CollisionBoxes = null,
        IReadOnlyDictionary<string, string>? MaterialSlots = null,
        IReadOnlyDictionary<string, IReadOnlyList<string>>? TextureSlots = null);

    public static readonly IReadOnlyList<CategorySeed> Categories =
    [
        new("Seating", ProductFamily.Furniture),
        new("Tables", ProductFamily.Furniture),
        new("Bedroom", ProductFamily.Furniture),
        new("Storage", ProductFamily.Furniture),
        new("Doors", ProductFamily.Fixture),
        new("Windows", ProductFamily.Fixture),
        new("Paint", ProductFamily.BuildingMaterial),
        new("Flooring", ProductFamily.BuildingMaterial),
    ];

    public static readonly IReadOnlyList<ItemSeed> Items =
    [
        // ── Bedroom ──────────────────────────────────────────────────────────
        new ItemSeed(
            Type: "bed",
            Label: "Bed",
            Width: 2.0m, Depth: 1.6m, Height: 0.5m,
            Color: "#8B4513",
            Icon: "bed",
            Category: "Bedroom",
            SvgPreview: BedSvg,
            BasePrice: 380m),

        new ItemSeed(
            Type: "nightstand",
            Label: "Nightstand",
            Width: 0.5m, Depth: 0.4m, Height: 0.55m,
            Color: "#A0522D",
            Icon: "lamp",
            Category: "Bedroom",
            SvgPreview: NightstandSvg,
            BasePrice: 95m),

        // ── Seating ──────────────────────────────────────────────────────────
        new ItemSeed(
            Type: "chair",
            Label: "Chair",
            Width: 0.5m, Depth: 0.5m, Height: 0.9m,
            Color: "#6B4226",
            Icon: "armchair",
            Category: "Seating",
            SvgPreview: ChairSvg,
            BasePrice: 120m),

        new ItemSeed(
            Type: "armchair",
            Label: "Armchair",
            Width: 0.85m, Depth: 0.81m, Height: 0.78m,
            Color: "#8B6B4A",
            Icon: "armchair",
            Category: "Seating",
            SvgPreview: ArmchairSvg,
            BasePrice: 340m,
            ModelUrl: "/models/armchair.glb"),

        new ItemSeed(
            Type: "sofa",
            Label: "Sofa",
            Width: 2.0m, Depth: 0.9m, Height: 0.8m,
            Color: "#4A6670",
            Icon: "sofa",
            Category: "Seating",
            SvgPreview: SofaSvg,
            BasePrice: 499m),

        new ItemSeed(
            Type: "sectional-sofa",
            Label: "Sectional Sofa",
            Width: 1.75m, Depth: 2.5m, Height: 0.53m,
            Color: "#4A5C50",
            Icon: "sofa",
            Category: "Seating",
            SvgPreview: SectionalSofaSvg,
            BasePrice: 899m,
            ModelUrl: "/models/sectional-sofa.glb",
            CollisionBoxes:
            [
                new CollisionBoxSeed(0m, -0.65m, 1.75m, 1.2m),
                new CollisionBoxSeed(-0.44m, 0.55m, 0.87m, 1.2m)
            ]),

        new ItemSeed(
            Type: "gray-sectional-sofa",
            Label: "Gray Sectional",
            Width: 2.47m, Depth: 2.5m, Height: 0.73m,
            Color: "#6B6B6B",
            Icon: "sofa",
            Category: "Seating",
            SvgPreview: GraySectionalSvg,
            BasePrice: 1099m,
            ModelUrl: "/models/gray-sectional-sofa.glb",
            CollisionBoxes:
            [
                new CollisionBoxSeed(0m, -0.65m, 2.47m, 1.2m),
                new CollisionBoxSeed(-0.8m, 0.55m, 0.87m, 1.2m)
            ]),

        new ItemSeed(
            Type: "colorable-sectional-sofa",
            Label: "Designer Sectional",
            Width: 2.06m, Depth: 1.77m, Height: 0.47m,
            Color: "#4A5C50",
            Icon: "sofa",
            Category: "Seating",
            SvgPreview: ColorableSectionalSvg,
            BasePrice: 1290m,
            ModelUrl: "/models/colorable-sectional-sofa.glb",
            CollisionBoxes:
            [
                new CollisionBoxSeed(-0.75m, -0.30m, 0.58m, 1.20m),
                new CollisionBoxSeed(0m, 0.59m, 2.06m, 0.60m)
            ],
            MaterialSlots: new Dictionary<string, string>
            {
                ["Body"] = "#4A5C50",
                ["Legs"] = "#1e120a",
                ["Pillows"] = "#5A6C60"
            },
            TextureSlots: new Dictionary<string, IReadOnlyList<string>>
            {
                ["Body"] = new[] { "", "/textures/corduroy-fabric.jpg" },
                ["Pillows"] = new[] { "", "/textures/corduroy-fabric.jpg" }
            }),

        // ── Tables ───────────────────────────────────────────────────────────
        new ItemSeed(
            Type: "table",
            Label: "Dining Table",
            Width: 1.2m, Depth: 0.8m, Height: 0.75m,
            Color: "#A0522D",
            Icon: "table",
            Category: "Tables",
            SvgPreview: TableSvg,
            BasePrice: 260m),

        new ItemSeed(
            Type: "desk",
            Label: "Desk",
            Width: 1.4m, Depth: 0.7m, Height: 0.75m,
            Color: "#DEB887",
            Icon: "monitor",
            Category: "Tables",
            SvgPreview: DeskSvg,
            BasePrice: 210m),

        // ── Storage ──────────────────────────────────────────────────────────
        new ItemSeed(
            Type: "wardrobe",
            Label: "Wardrobe",
            Width: 1.5m, Depth: 0.6m, Height: 2.0m,
            Color: "#5C4033",
            Icon: "door-open",
            Category: "Storage",
            SvgPreview: WardrobeSvg,
            BasePrice: 540m),

        new ItemSeed(
            Type: "bookshelf",
            Label: "Bookshelf",
            Width: 1.0m, Depth: 0.35m, Height: 1.8m,
            Color: "#8B6914",
            Icon: "book-open",
            Category: "Storage",
            SvgPreview: BookshelfSvg,
            BasePrice: 175m),

        // ── Fixtures (Phase 6) ──────────────────────────────────────────────
        new ItemSeed(
            Type: "solid-oak-door",
            Label: "Solid Oak Door",
            // Width and Height match the cut-out in the wall; Depth is the
            // frame thickness so the variant fits standard 5 cm wall jambs.
            Width: 0.90m, Depth: 0.05m, Height: 2.10m,
            Color: "#7A5230",
            Icon: "door-open",
            Category: "Doors",
            SvgPreview: DoorSvg,
            Family: ProductFamily.Fixture,
            BasePrice: 220m),

        new ItemSeed(
            Type: "pvc-window",
            Label: "PVC Window",
            Width: 1.20m, Depth: 0.05m, Height: 1.20m,
            Color: "#E8E4DC",
            Icon: "square",
            Category: "Windows",
            SvgPreview: WindowSvg,
            Family: ProductFamily.Fixture,
            BasePrice: 135m),

        // ── Building materials (Phase 6) ────────────────────────────────────
        // Three paint + three flooring tiers showcase the request-quote dialog's
        // calculator: different coverage rates and price points produce visibly
        // different per-line totals.
        new ItemSeed(
            Type: "interior-matt-paint",
            Label: "Interior Matt Paint",
            // Dimensions are placeholder (1 L can footprint); not placed in the scene.
            Width: 0.18m, Depth: 0.18m, Height: 0.20m,
            Color: "#F4F0E8",
            Icon: "paint-bucket",
            Category: "Paint",
            SvgPreview: PaintSvg,
            Family: ProductFamily.BuildingMaterial,
            UnitOfSale: UnitOfSale.Liter,
            CoverageRate: 10m,
            WasteFactor: 0.10m,
            BasePrice: 4m,
            TextureUrl: "/textures/interior-matt-paint.jpg"),

        new ItemSeed(
            Type: "premium-eco-paint",
            Label: "Premium Eco Paint",
            Width: 0.18m, Depth: 0.18m, Height: 0.20m,
            Color: "#EAE6DC",
            Icon: "paint-bucket",
            Category: "Paint",
            SvgPreview: PremiumPaintSvg,
            Family: ProductFamily.BuildingMaterial,
            UnitOfSale: UnitOfSale.Liter,
            // Wider coverage than the budget paint, so per-line totals diverge
            // sharply once a room's wall area is plugged in.
            CoverageRate: 12m,
            WasteFactor: 0.10m,
            BasePrice: 9m,
            TextureUrl: "/textures/premium-eco-paint.jpg"),

        new ItemSeed(
            Type: "exterior-weather-paint",
            Label: "Exterior Weather Paint",
            Width: 0.18m, Depth: 0.18m, Height: 0.20m,
            Color: "#D8D2C2",
            Icon: "paint-bucket",
            Category: "Paint",
            SvgPreview: ExteriorPaintSvg,
            Family: ProductFamily.BuildingMaterial,
            UnitOfSale: UnitOfSale.Liter,
            CoverageRate: 8m,
            WasteFactor: 0.10m,
            BasePrice: 6m,
            TextureUrl: "/textures/exterior-weather-paint.jpg"),

        new ItemSeed(
            Type: "oak-laminate-flooring",
            Label: "Oak Laminate Flooring",
            // Dimensions describe a single plank for reference only.
            Width: 1.20m, Depth: 0.20m, Height: 0.008m,
            Color: "#A0784A",
            Icon: "square",
            Category: "Flooring",
            SvgPreview: FlooringSvg,
            Family: ProductFamily.BuildingMaterial,
            UnitOfSale: UnitOfSale.SquareMeter,
            WasteFactor: 0.05m,
            BasePrice: 18m,
            TextureUrl: "/textures/oak-laminate-flooring.jpg"),

        new ItemSeed(
            Type: "budget-vinyl-flooring",
            Label: "Budget Vinyl Flooring",
            Width: 1.20m, Depth: 0.20m, Height: 0.005m,
            Color: "#C0A074",
            Icon: "square",
            Category: "Flooring",
            SvgPreview: VinylFlooringSvg,
            Family: ProductFamily.BuildingMaterial,
            UnitOfSale: UnitOfSale.SquareMeter,
            WasteFactor: 0.07m,
            BasePrice: 11m,
            TextureUrl: "/textures/budget-vinyl-flooring.jpg"),

        new ItemSeed(
            Type: "engineered-hardwood",
            Label: "Engineered Hardwood",
            Width: 1.20m, Depth: 0.20m, Height: 0.014m,
            Color: "#6B4A2C",
            Icon: "square",
            Category: "Flooring",
            SvgPreview: HardwoodSvg,
            Family: ProductFamily.BuildingMaterial,
            UnitOfSale: UnitOfSale.SquareMeter,
            WasteFactor: 0.05m,
            BasePrice: 45m,
            TextureUrl: "/textures/engineered-hardwood.jpg"),
    ];

    // ── SVG previews (verbatim from frontend/src/utils/furnitureCatalog.ts) ─

    private const string BedSvg = """
        <svg viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg" fill="none">
            <rect x="4" y="4" width="92" height="72" rx="4" fill="#c8a882" stroke="currentColor" stroke-width="2"/>
            <rect x="4" y="4" width="92" height="16" rx="3" fill="#8B6340" stroke="currentColor" stroke-width="2"/>
            <rect x="12" y="26" width="30" height="18" rx="4" fill="#f0e8dc" stroke="currentColor" stroke-width="1.5"/>
            <rect x="58" y="26" width="30" height="18" rx="4" fill="#f0e8dc" stroke="currentColor" stroke-width="1.5"/>
            <line x1="4" y1="54" x2="96" y2="54" stroke="currentColor" stroke-width="1" stroke-dasharray="4 3"/>
        </svg>
        """;

    private const string NightstandSvg = """
        <svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" fill="none">
            <rect x="4" y="4" width="52" height="52" rx="3" fill="#c4a97a" stroke="currentColor" stroke-width="2"/>
            <line x1="4" y1="32" x2="56" y2="32" stroke="currentColor" stroke-width="1.5"/>
            <rect x="22" y="38" width="16" height="4" rx="2" fill="currentColor" opacity="0.4"/>
            <circle cx="30" cy="18" r="8" fill="#f5e6c8" stroke="currentColor" stroke-width="1.5"/>
        </svg>
        """;

    private const string ChairSvg = """
        <svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" fill="none">
            <rect x="8" y="14" width="44" height="38" rx="5" fill="#8B6340" stroke="currentColor" stroke-width="2"/>
            <rect x="8" y="4" width="44" height="14" rx="4" fill="#6B4226" stroke="currentColor" stroke-width="2"/>
            <rect x="14" y="20" width="32" height="26" rx="3" fill="#a07850" stroke="currentColor" stroke-width="1"/>
            <circle cx="12" cy="48" r="3" fill="currentColor" opacity="0.5"/>
            <circle cx="48" cy="48" r="3" fill="currentColor" opacity="0.5"/>
        </svg>
        """;

    private const string ArmchairSvg = """
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none">
          <rect x="8" y="8" width="84" height="84" rx="8" fill="#8B6B4A" stroke="currentColor" stroke-width="2"/>
          <rect x="14" y="30" width="72" height="56" rx="4" fill="#9B7B5A" stroke="currentColor" stroke-width="1"/>
          <rect x="8" y="8" width="84" height="26" rx="6" fill="#7B5B3A" stroke="currentColor" stroke-width="2"/>
        </svg>
        """;

    private const string SofaSvg = """
        <svg viewBox="0 0 120 60" xmlns="http://www.w3.org/2000/svg" fill="none">
            <rect x="4" y="4" width="112" height="18" rx="5" fill="#3d5a64" stroke="currentColor" stroke-width="2"/>
            <rect x="4" y="20" width="112" height="32" rx="4" fill="#4A6670" stroke="currentColor" stroke-width="2"/>
            <rect x="4" y="20" width="14" height="32" rx="3" fill="#3d5a64" stroke="currentColor" stroke-width="1.5"/>
            <rect x="102" y="20" width="14" height="32" rx="3" fill="#3d5a64" stroke="currentColor" stroke-width="1.5"/>
            <line x1="62" y1="22" x2="62" y2="50" stroke="currentColor" stroke-width="1" stroke-dasharray="3 2"/>
            <rect x="20" y="24" width="38" height="22" rx="3" fill="#557080" stroke="currentColor" stroke-width="1"/>
            <rect x="62" y="24" width="38" height="22" rx="3" fill="#557080" stroke="currentColor" stroke-width="1"/>
        </svg>
        """;

    private const string SectionalSofaSvg = """
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none">
          <path d="M4 4 L70 4 L70 45 L40 45 L40 96 L4 96 Z" fill="#4A5C50" stroke="currentColor" stroke-width="2"/>
          <path d="M10 10 L64 10 L64 40 L36 40 L36 90 L10 90 Z" fill="#5A6C60" stroke="currentColor" stroke-width="1"/>
        </svg>
        """;

    private const string GraySectionalSvg = """
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none">
          <path d="M4 4 L96 4 L96 45 L50 45 L50 96 L4 96 Z" fill="#6B6B6B" stroke="currentColor" stroke-width="2"/>
          <path d="M10 10 L90 10 L90 40 L44 40 L44 90 L10 90 Z" fill="#7B7B7B" stroke="currentColor" stroke-width="1"/>
        </svg>
        """;

    private const string ColorableSectionalSvg = """
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none">
          <path d="M4 4 L96 4 L96 45 L50 45 L50 96 L4 96 Z" fill="#4A5C50" stroke="currentColor" stroke-width="2"/>
          <path d="M10 10 L90 10 L90 40 L44 40 L44 90 L10 90 Z" fill="#5A6C60" stroke="currentColor" stroke-width="1"/>
          <circle cx="30" cy="18" r="6" fill="#5A6C60" stroke="currentColor" stroke-width="1" opacity="0.8"/>
          <circle cx="50" cy="18" r="6" fill="#5A6C60" stroke="currentColor" stroke-width="1" opacity="0.8"/>
          <circle cx="70" cy="18" r="6" fill="#5A6C60" stroke="currentColor" stroke-width="1" opacity="0.8"/>
        </svg>
        """;

    private const string TableSvg = """
        <svg viewBox="0 0 100 70" xmlns="http://www.w3.org/2000/svg" fill="none">
            <rect x="6" y="6" width="88" height="58" rx="4" fill="#c4975a" stroke="currentColor" stroke-width="2"/>
            <line x1="6" y1="22" x2="94" y2="22" stroke="currentColor" stroke-width="0.8" opacity="0.3"/>
            <line x1="6" y1="35" x2="94" y2="35" stroke="currentColor" stroke-width="0.8" opacity="0.3"/>
            <line x1="6" y1="48" x2="94" y2="48" stroke="currentColor" stroke-width="0.8" opacity="0.3"/>
            <circle cx="14" cy="14" r="4" fill="#8B6340" stroke="currentColor" stroke-width="1.5"/>
            <circle cx="86" cy="14" r="4" fill="#8B6340" stroke="currentColor" stroke-width="1.5"/>
            <circle cx="14" cy="56" r="4" fill="#8B6340" stroke="currentColor" stroke-width="1.5"/>
            <circle cx="86" cy="56" r="4" fill="#8B6340" stroke="currentColor" stroke-width="1.5"/>
        </svg>
        """;

    private const string DeskSvg = """
        <svg viewBox="0 0 110 60" xmlns="http://www.w3.org/2000/svg" fill="none">
            <rect x="4" y="4" width="102" height="52" rx="3" fill="#d4b896" stroke="currentColor" stroke-width="2"/>
            <rect x="74" y="8" width="28" height="44" rx="2" fill="#b8956a" stroke="currentColor" stroke-width="1.5"/>
            <line x1="74" y1="22" x2="102" y2="22" stroke="currentColor" stroke-width="1"/>
            <line x1="74" y1="36" x2="102" y2="36" stroke="currentColor" stroke-width="1"/>
            <rect x="83" y="27" width="10" height="3" rx="1.5" fill="currentColor" opacity="0.4"/>
            <rect x="83" y="41" width="10" height="3" rx="1.5" fill="currentColor" opacity="0.4"/>
            <rect x="20" y="10" width="40" height="26" rx="2" fill="#c8ad8a" stroke="currentColor" stroke-width="1" stroke-dasharray="3 2"/>
        </svg>
        """;

    private const string WardrobeSvg = """
        <svg viewBox="0 0 80 60" xmlns="http://www.w3.org/2000/svg" fill="none">
            <rect x="4" y="4" width="72" height="52" rx="3" fill="#6B5040" stroke="currentColor" stroke-width="2"/>
            <line x1="40" y1="4" x2="40" y2="56" stroke="currentColor" stroke-width="1.5"/>
            <rect x="32" y="26" width="5" height="8" rx="2.5" fill="currentColor" opacity="0.5"/>
            <rect x="43" y="26" width="5" height="8" rx="2.5" fill="currentColor" opacity="0.5"/>
            <line x1="4" y1="18" x2="76" y2="18" stroke="currentColor" stroke-width="1" stroke-dasharray="3 2"/>
            <rect x="8" y="52" width="8" height="4" rx="1" fill="#4a3828" stroke="currentColor" stroke-width="1"/>
            <rect x="64" y="52" width="8" height="4" rx="1" fill="#4a3828" stroke="currentColor" stroke-width="1"/>
        </svg>
        """;

    private const string BookshelfSvg = """
        <svg viewBox="0 0 70 80" xmlns="http://www.w3.org/2000/svg" fill="none">
            <rect x="4" y="4" width="62" height="72" rx="3" fill="#8B7040" stroke="currentColor" stroke-width="2"/>
            <line x1="4" y1="22" x2="66" y2="22" stroke="currentColor" stroke-width="2"/>
            <line x1="4" y1="40" x2="66" y2="40" stroke="currentColor" stroke-width="2"/>
            <line x1="4" y1="58" x2="66" y2="58" stroke="currentColor" stroke-width="2"/>
            <rect x="8" y="9" width="6" height="12" rx="1" fill="#c05030"/>
            <rect x="16" y="10" width="5" height="11" rx="1" fill="#3060a0"/>
            <rect x="23" y="9" width="7" height="12" rx="1" fill="#40904a"/>
            <rect x="32" y="10" width="4" height="11" rx="1" fill="#9030a0"/>
            <rect x="38" y="9" width="6" height="12" rx="1" fill="#c09020"/>
            <rect x="46" y="10" width="5" height="11" rx="1" fill="#308080"/>
            <rect x="53" y="9" width="7" height="12" rx="1" fill="#a04030"/>
            <rect x="8" y="27" width="8" height="12" rx="1" fill="#3060a0" opacity="0.7"/>
            <rect x="18" y="27" width="5" height="12" rx="1" fill="#c05030" opacity="0.7"/>
            <rect x="25" y="27" width="7" height="12" rx="1" fill="#40904a" opacity="0.7"/>
            <rect x="34" y="27" width="6" height="12" rx="1" fill="#c09020" opacity="0.7"/>
            <rect x="42" y="27" width="5" height="12" rx="1" fill="#9030a0" opacity="0.7"/>
            <rect x="49" y="27" width="9" height="12" rx="1" fill="#308080" opacity="0.7"/>
            <rect x="8" y="45" width="6" height="12" rx="1" fill="#a04030" opacity="0.6"/>
            <rect x="16" y="45" width="9" height="12" rx="1" fill="#3060a0" opacity="0.6"/>
            <rect x="27" y="45" width="5" height="12" rx="1" fill="#40904a" opacity="0.6"/>
            <rect x="34" y="45" width="7" height="12" rx="1" fill="#c05030" opacity="0.6"/>
            <rect x="43" y="45" width="6" height="12" rx="1" fill="#9030a0" opacity="0.6"/>
            <rect x="51" y="45" width="7" height="12" rx="1" fill="#c09020" opacity="0.6"/>
        </svg>
        """;

    // ── Phase 6 SVG previews ─────────────────────────────────────────────

    private const string DoorSvg = """
        <svg viewBox="0 0 60 100" xmlns="http://www.w3.org/2000/svg" fill="none">
            <rect x="4" y="4" width="52" height="92" rx="2" fill="#7A5230" stroke="currentColor" stroke-width="2"/>
            <rect x="10" y="10" width="40" height="38" rx="1" fill="#8B6340" stroke="currentColor" stroke-width="1"/>
            <rect x="10" y="54" width="40" height="38" rx="1" fill="#8B6340" stroke="currentColor" stroke-width="1"/>
            <circle cx="48" cy="54" r="1.6" fill="currentColor"/>
        </svg>
        """;

    private const string WindowSvg = """
        <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" fill="none">
            <rect x="4" y="4" width="72" height="72" rx="2" fill="#E8E4DC" stroke="currentColor" stroke-width="2"/>
            <line x1="40" y1="4" x2="40" y2="76" stroke="currentColor" stroke-width="2"/>
            <line x1="4" y1="40" x2="76" y2="40" stroke="currentColor" stroke-width="2"/>
            <rect x="8" y="8" width="28" height="28" fill="#cce4ee" opacity="0.5"/>
            <rect x="44" y="8" width="28" height="28" fill="#cce4ee" opacity="0.5"/>
            <rect x="8" y="44" width="28" height="28" fill="#cce4ee" opacity="0.5"/>
            <rect x="44" y="44" width="28" height="28" fill="#cce4ee" opacity="0.5"/>
        </svg>
        """;

    private const string PaintSvg = """
        <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" fill="none">
            <path d="M14 24 L66 24 L60 72 L20 72 Z" fill="#F4F0E8" stroke="currentColor" stroke-width="2"/>
            <ellipse cx="40" cy="24" rx="26" ry="6" fill="#dcd5c4" stroke="currentColor" stroke-width="2"/>
            <path d="M22 18 Q40 8 58 18" stroke="currentColor" stroke-width="2" fill="none"/>
            <rect x="34" y="44" width="12" height="14" rx="2" fill="currentColor" opacity="0.25"/>
        </svg>
        """;

    private const string FlooringSvg = """
        <svg viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg" fill="none">
            <rect x="4" y="4" width="92" height="72" rx="2" fill="#A0784A" stroke="currentColor" stroke-width="2"/>
            <rect x="6" y="6" width="42" height="20" fill="#B0885A" stroke="currentColor" stroke-width="0.8"/>
            <rect x="52" y="6" width="42" height="20" fill="#9A7244" stroke="currentColor" stroke-width="0.8"/>
            <rect x="6" y="30" width="42" height="20" fill="#9A7244" stroke="currentColor" stroke-width="0.8"/>
            <rect x="52" y="30" width="42" height="20" fill="#B0885A" stroke="currentColor" stroke-width="0.8"/>
            <rect x="6" y="54" width="42" height="20" fill="#B0885A" stroke="currentColor" stroke-width="0.8"/>
            <rect x="52" y="54" width="42" height="20" fill="#9A7244" stroke="currentColor" stroke-width="0.8"/>
        </svg>
        """;

    private const string PremiumPaintSvg = """
        <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" fill="none">
            <path d="M14 24 L66 24 L60 72 L20 72 Z" fill="#EAE6DC" stroke="currentColor" stroke-width="2"/>
            <ellipse cx="40" cy="24" rx="26" ry="6" fill="#cfc8b8" stroke="currentColor" stroke-width="2"/>
            <path d="M22 18 Q40 8 58 18" stroke="currentColor" stroke-width="2" fill="none"/>
            <rect x="34" y="44" width="12" height="14" rx="2" fill="currentColor" opacity="0.25"/>
            <path d="M30 60 L42 36 L54 60 Z" fill="#86c08a" stroke="currentColor" stroke-width="1.5" opacity="0.85"/>
        </svg>
        """;

    private const string ExteriorPaintSvg = """
        <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" fill="none">
            <path d="M14 24 L66 24 L60 72 L20 72 Z" fill="#D8D2C2" stroke="currentColor" stroke-width="2"/>
            <ellipse cx="40" cy="24" rx="26" ry="6" fill="#b8b0a0" stroke="currentColor" stroke-width="2"/>
            <path d="M22 18 Q40 8 58 18" stroke="currentColor" stroke-width="2" fill="none"/>
            <rect x="34" y="44" width="12" height="14" rx="2" fill="currentColor" opacity="0.25"/>
            <circle cx="58" cy="58" r="6" fill="#f6c45c" stroke="currentColor" stroke-width="1.5"/>
            <path d="M58 50 L58 46 M58 70 L58 66 M50 58 L46 58 M70 58 L66 58" stroke="#f6c45c" stroke-width="1.5"/>
        </svg>
        """;

    private const string VinylFlooringSvg = """
        <svg viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg" fill="none">
            <rect x="4" y="4" width="92" height="72" rx="2" fill="#C0A074" stroke="currentColor" stroke-width="2"/>
            <rect x="6" y="6" width="92" height="14" fill="#D0B084" stroke="currentColor" stroke-width="0.5"/>
            <rect x="6" y="24" width="92" height="14" fill="#B89464" stroke="currentColor" stroke-width="0.5"/>
            <rect x="6" y="42" width="92" height="14" fill="#D0B084" stroke="currentColor" stroke-width="0.5"/>
            <rect x="6" y="60" width="92" height="14" fill="#B89464" stroke="currentColor" stroke-width="0.5"/>
        </svg>
        """;

    private const string HardwoodSvg = """
        <svg viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg" fill="none">
            <rect x="4" y="4" width="92" height="72" rx="2" fill="#6B4A2C" stroke="currentColor" stroke-width="2"/>
            <rect x="6" y="6" width="28" height="68" fill="#7B5A3A" stroke="currentColor" stroke-width="0.8"/>
            <rect x="36" y="6" width="28" height="68" fill="#5B3A20" stroke="currentColor" stroke-width="0.8"/>
            <rect x="66" y="6" width="28" height="68" fill="#7B5A3A" stroke="currentColor" stroke-width="0.8"/>
            <line x1="12" y1="6" x2="12" y2="74" stroke="#3a2814" stroke-width="0.4" opacity="0.6"/>
            <line x1="22" y1="6" x2="22" y2="74" stroke="#3a2814" stroke-width="0.4" opacity="0.6"/>
            <line x1="42" y1="6" x2="42" y2="74" stroke="#2a1804" stroke-width="0.4" opacity="0.6"/>
            <line x1="52" y1="6" x2="52" y2="74" stroke="#2a1804" stroke-width="0.4" opacity="0.6"/>
            <line x1="72" y1="6" x2="72" y2="74" stroke="#3a2814" stroke-width="0.4" opacity="0.6"/>
            <line x1="82" y1="6" x2="82" y2="74" stroke="#3a2814" stroke-width="0.4" opacity="0.6"/>
        </svg>
        """;
}
