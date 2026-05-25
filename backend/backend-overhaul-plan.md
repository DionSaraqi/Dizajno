# Backend Overhaul Plan

Restructure the .NET backend with clean separation of concerns: DTOs isolated, business logic in Application services, persistence in Data, infrastructure trimmed to auth/plumbing only. Upgrade to .NET 10 LTS.

## Current vs Target

| Concern | Current | Target |
|---|---|---|
| .NET version | `net8.0` | `net10.0` |
| DTOs location | `Dizajno.Api/Contracts/` — 8 files, many grouped | `Dizajno.Dto/` — new project, 1 file per record |
| Business logic | In controllers + scattered in Infrastructure | `Dizajno.Application/` — service interfaces + impls |
| Persistence | `Dizajno.Infrastructure/Persistence/` | `Dizajno.Data/` — new project |
| Infrastructure | Identity, Auth, Storage, Audit, Suppliers, Persistence | Only Identity, Auth, Storage, Audit plumbing |
| Domain | Entities + Enums | Unchanged |

---

## New Project Layout

```
backend/src/
├── Dizajno.Api/                     # ASP.NET Core host
│   ├── Program.cs                   # updated for .NET 10, service registration
│   ├── Controllers/                 # thin — delegates to Application services
│   │   ├── AuthController.cs
│   │   ├── CatalogController.cs
│   │   ├── ProjectsController.cs
│   │   ├── QuotesController.cs
│   │   ├── AssetsController.cs
│   │   ├── InvitesController.cs
│   │   ├── SharedProjectsController.cs
│   │   ├── AdminAuditLogController.cs
│   │   ├── AdminInvitesController.cs
│   │   ├── AdminModerationController.cs
│   │   ├── AdminSupplierMembersController.cs
│   │   ├── AdminSuppliersController.cs
│   │   ├── SupplierAssetsController.cs
│   │   ├── SupplierCategoriesController.cs
│   │   ├── SupplierInvitesController.cs
│   │   ├── SupplierMembersController.cs
│   │   ├── SupplierProductsController.cs
│   │   ├── SupplierProfileController.cs
│   │   ├── SupplierQuotesController.cs
│   │   ├── SupplierTexturesController.cs
│   │   └── SupplierVariantsController.cs
│   ├── Properties/launchSettings.json
│   └── appsettings*.json
│
├── Dizajno.Application/             # Business logic services
│   ├── Services/                    # Implementations
│   │   ├── AuthService.cs
│   │   ├── CatalogService.cs
│   │   ├── ProjectService.cs
│   │   ├── QuoteService.cs
│   │   ├── AdminService.cs
│   │   ├── SupplierProductService.cs
│   │   ├── SupplierInviteService.cs
│   │   └── SharingService.cs
│   ├── Interfaces/                  # Service contracts (move from current root)
│   │   ├── IAuthService.cs
│   │   ├── ICatalogService.cs
│   │   ├── IProjectService.cs
│   │   ├── IQuoteService.cs
│   │   ├── IAdminService.cs
│   │   ├── ISupplierService.cs
│   │   ├── ISharingService.cs
│   │   ├── IJwtTokenService.cs        (kept, implemented in Infrastructure)
│   │   ├── IDataSeeder.cs            (kept, implemented in Data)
│   │   ├── IObjectStorage.cs         (kept, implemented in Infrastructure)
│   │   ├── ISupplierMembershipResolver.cs (kept, implemented in Infrastructure)
│   │   └── IAuditLogger.cs           (kept, implemented in Infrastructure)
│   ├── Options/                     # Configuration POCOs
│   │   ├── JwtOptions.cs
│   │   ├── SeedOptions.cs
│   │   ├── R2Options.cs
│   │   └── InviteOptions.cs
│   └── Suppliers/                   # Extensions (moved from current root)
│       └── SupplierMembershipExtensions.cs
│
├── Dizajno.Domain/                  # Pure entities + enums (unchanged)
│   ├── Entities/                      24 entity classes
│   └── Enums/                         10 enums
│
├── Dizajno.Dto/                     # Data Transfer Objects (NEW)
│   ├── Auth/
│   │   ├── RegisterRequest.cs
│   │   ├── LoginRequest.cs
│   │   ├── AuthResponse.cs
│   │   ├── UserSummary.cs
│   │   └── SupplierMembershipDto.cs
│   ├── Catalog/
│   │   ├── FurnitureItemDto.cs
│   │   ├── CategoryDto.cs
│   │   └── SupplierDto.cs
│   ├── Project/
│   │   ├── CreateProjectRequest.cs
│   │   ├── UpdateProjectRequest.cs
│   │   ├── ProjectSummaryDto.cs
│   │   ├── ProjectDetailDto.cs
│   │   ├── SceneDto.cs
│   │   ├── WallDto.cs
│   │   ├── FloorDto.cs
│   │   ├── OpeningDto.cs
│   │   ├── PlacedItemDto.cs
│   │   ├── CreateVersionRequest.cs
│   │   └── ProjectVersionSummaryDto.cs
│   ├── Quote/
│   │   ├── CreateQuoteRequest.cs
│   │   ├── QuoteSummaryDto.cs
│   │   ├── QuoteDetailDto.cs
│   │   ├── QuoteLineDto.cs
│   │   ├── QuoteRequestDto.cs
│   │   ├── QuoteResponseDto.cs
│   │   ├── SupplierQuoteRequestSummaryDto.cs
│   │   ├── SupplierQuoteRequestDetailDto.cs
│   │   ├── RespondToQuoteRequest.cs
│   │   └── DeclineQuoteRequest.cs
│   ├── Asset/
│   │   ├── AssetDto.cs
│   │   ├── PresignAssetUploadRequest.cs
│   │   └── PresignAssetUploadResponse.cs
│   ├── Share/
│   │   ├── CreateProjectShareRequest.cs
│   │   ├── ProjectShareDto.cs
│   │   ├── SharedProjectDto.cs
│   │   ├── PostCommentRequest.cs
│   │   └── ProjectCommentDto.cs
│   ├── Admin/
│   │   ├── AdminSupplierDto.cs
│   │   ├── CreateSupplierRequest.cs
│   │   ├── UpdateSupplierRequest.cs
│   │   ├── CreateSupplierInviteRequest.cs
│   │   ├── SupplierInviteDto.cs
│   │   ├── InvitePreviewDto.cs
│   │   ├── CreateSupplierMemberRequest.cs
│   │   ├── SupplierMemberDto.cs
│   │   ├── PendingProductDto.cs
│   │   ├── PendingCategoryDto.cs
│   │   ├── AuditLogEntryDto.cs
│   │   └── AuditLogPageDto.cs
│   └── Supplier/
│       ├── CreateProductRequest.cs
│       ├── UpdateProductRequest.cs
│       ├── SupplierProductDto.cs
│       ├── CreateVariantRequest.cs
│       ├── UpdateVariantRequest.cs
│       ├── ProductVariantDto.cs
│       ├── AttachAssetRequest.cs
│       ├── CreateTextureRequest.cs
│       ├── UpdateTextureRequest.cs
│       ├── SupplierTextureDto.cs
│       ├── TextureSlotDto.cs
│       ├── SetTextureSlotsRequest.cs
│       ├── CreateCategoryRequest.cs
│       ├── SupplierCategoryDto.cs
│       ├── UpdateMemberRoleRequest.cs
│       ├── SupplierMemberRosterDto.cs
│       ├── UpdateSupplierProfileRequest.cs
│       ├── SupplierProfileDto.cs
│       └── CreateSupplierOwnerInviteRequest.cs
│
├── Dizajno.Data/                    # Persistence layer (NEW)
│   ├── DizajnoDbContext.cs          (moved from Infrastructure)
│   ├── Configurations/                24 EF type configurations
│   ├── Migrations/                    10 migrations + snapshot
│   ├── Seed/
│   │   ├── CatalogSeedData.cs
│   │   └── DataSeeder.cs
│   └── DependencyInjection.cs       # AddData() extension
│
└── Dizajno.Infrastructure/          # Technical plumbing (trimmed)
    ├── Auth/
    │   └── JwtTokenService.cs       # implements IJwtTokenService
    ├── Identity/
    │   ├── ApplicationUser.cs
    │   └── RefreshToken.cs
    ├── Storage/
    │   └── S3ObjectStorage.cs       # implements IObjectStorage
    ├── Audit/
    │   └── AuditLogger.cs           # implements IAuditLogger
    ├── Suppliers/
    │   └── SupplierMembershipResolver.cs # implements ISupplierMembershipResolver
    └── DependencyInjection.cs       # AddInfrastructure() — Identity, JWT, Storage, Audit wiring
```

---

## New Dependency Graph

```
Api ──────────→ Dto, Application, Infrastructure, Data
Application ──→ Domain, Dto
Domain ───────→ (nothing — zero deps)
Dto ──────────→ Domain (for enum references)
Data ─────────→ Domain
Infrastructure → Application, Domain
```

---

## Work Breakdown (Execution Order)

### Phase 1: Project scaffolding

1. Create `Dizajno.Dto` classlib project, target `net10.0`, reference `Dizajno.Domain`
2. Create `Dizajno.Data` classlib project, target `net10.0`, reference `Dizajno.Domain`, add EF Core packages
3. Update all existing `.csproj` files to target `net10.0`
4. Add Dizajno.Dto and Dizajno.Data to `Dizajno.sln`

### Phase 2: DTO extraction

5. Move each contract file's records into individual files under `Dizajno.Dto/`
6. Split `AdminContracts.cs` → 12 files under `Dto/Admin/`
7. Split `AuthContracts.cs` → 5 files under `Dto/Auth/`
8. Split `CatalogContracts.cs` → 3 files under `Dto/Catalog/`
9. Split `ProjectContracts.cs` → 11 files under `Dto/Project/`
10. Split `QuoteContracts.cs` → 10 files under `Dto/Quote/`
11. Split `AssetContracts.cs` → 3 files under `Dto/Asset/`
12. Split `ShareContracts.cs` → 5 files under `Dto/Share/`
13. Split `SupplierPortalContracts.cs` → 19 files under `Dto/Supplier/`
14. Namespace each as `Dizajno.Dto.{Area}`
15. Update all `using` directives across every project that referenced `Dizajno.Api.Contracts`
16. Delete old `Contracts/` folder from Api project

### Phase 3: Data layer extraction

17. Move `DizajnoDbContext.cs` from `Infrastructure/Persistence/` → `Data/`
18. Move `Configurations/` (24 files) from `Infrastructure/Persistence/Configurations/` → `Data/Configurations/`
19. Move `Migrations/` (20 files + snapshot) from `Infrastructure/Migrations/` → `Data/Migrations/`
20. Move `Seed/` (DataSeeder.cs, CatalogSeedData.cs) from `Infrastructure/Persistence/Seed/` → `Data/Seed/`
21. Update all namespaces in moved files
22. Create `Data/DependencyInjection.cs` with `AddData()` extension
23. Remove DbContext/DataSeeder registrations from `Infrastructure/DependencyInjection.cs`
24. Update `Api/Program.cs` — call `AddData()` alongside `AddInfrastructure()`

### Phase 4: Application services (extract business logic)

25. Create service interfaces in `Application/Interfaces/`: IAuthService, ICatalogService, IProjectService, IQuoteService, IAdminService, ISupplierService, ISharingService
26. Create service implementations in `Application/Services/`, extracting business logic from controllers
27. Register services via `AddApplication()` extension in Application
28. Rewrite controllers to delegate to services — remove direct DbContext usage

### Phase 5: Infrastructure trim

29. Remove Persistence/ and Migrations/ from Infrastructure (already moved to Data)
30. Keep only: Auth/, Identity/, Storage/, Audit/, Suppliers/, DependencyInjection.cs

### Phase 6: Package & tool updates

31. Update all NuGet packages to latest versions for `net10.0`
32. Update `dotnet-ef` tool to latest for net10.0

### Phase 7: Verification

33. `dotnet build` — all projects
34. `dotnet test` — all 79 integration tests pass
35. Run API — verify endpoints via Swagger
36. Update `BACKEND.md` to reflect new structure and .NET 10 prereqs

---

## Key Decisions

| Decision | Rationale |
|---|---|
| DTOs as separate project | Api should only host/route. DTOs shared between Api, Application, tests |
| 1 file per DTO record | Discoverability, merge conflict reduction |
| Service implementations in Application | User explicitly wants Application = services. Infrastructure = plumbing |
| Data as separate project | Clean separation. Tests can reference Data without Infrastructure |
| RefreshToken + ApplicationUser in Infrastructure | ASP.NET Core Identity classes — technical concern, not domain |
| JwtTokenService in Infrastructure | Depends on Identity internals — infra concern |

---

## Current Inventory

| Project | .cs files |
|---|---|
| Dizajno.Api | 30 (1 Program + 21 Controllers + 8 Contracts) |
| Dizajno.Application | 9 |
| Dizajno.Domain | 25 (15 Entities + 10 Enums) |
| Dizajno.Infrastructure | 57 (27 Persistence + 20 Migrations + 10 other) |
| Dizajno.IntegrationTests | 12 |
| **Total** | **133** |
