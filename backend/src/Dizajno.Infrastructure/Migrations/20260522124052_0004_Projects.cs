using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dizajno.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class _0004_Projects : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "projects",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    owner_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    thumbnail_asset_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_projects", x => x.id);
                    table.ForeignKey(
                        name: "fk_projects_assets_thumbnail_asset_id",
                        column: x => x.thumbnail_asset_id,
                        principalTable: "assets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "floors",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    project_id = table.Column<Guid>(type: "uuid", nullable: false),
                    vertices = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_floors", x => x.id);
                    table.ForeignKey(
                        name: "fk_floors_projects_project_id",
                        column: x => x.project_id,
                        principalTable: "projects",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "placed_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    project_id = table.Column<Guid>(type: "uuid", nullable: false),
                    product_variant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    position_x = table.Column<decimal>(type: "numeric(10,4)", nullable: false),
                    position_z = table.Column<decimal>(type: "numeric(10,4)", nullable: false),
                    rotation = table.Column<decimal>(type: "numeric(8,5)", nullable: false),
                    scale = table.Column<decimal>(type: "numeric(5,3)", nullable: false, defaultValue: 1m),
                    scaled_width = table.Column<decimal>(type: "numeric(8,3)", nullable: false),
                    scaled_depth = table.Column<decimal>(type: "numeric(8,3)", nullable: false),
                    scaled_height = table.Column<decimal>(type: "numeric(8,3)", nullable: false),
                    material_colors = table.Column<string>(type: "jsonb", nullable: true),
                    material_textures = table.Column<string>(type: "jsonb", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_placed_items", x => x.id);
                    table.ForeignKey(
                        name: "fk_placed_items_product_variants_product_variant_id",
                        column: x => x.product_variant_id,
                        principalTable: "product_variants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_placed_items_projects_project_id",
                        column: x => x.project_id,
                        principalTable: "projects",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "project_versions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    project_id = table.Column<Guid>(type: "uuid", nullable: false),
                    label = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    scene_snapshot = table.Column<string>(type: "jsonb", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_project_versions", x => x.id);
                    table.ForeignKey(
                        name: "fk_project_versions_projects_project_id",
                        column: x => x.project_id,
                        principalTable: "projects",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "walls",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    project_id = table.Column<Guid>(type: "uuid", nullable: false),
                    start_x = table.Column<decimal>(type: "numeric(10,4)", nullable: false),
                    start_z = table.Column<decimal>(type: "numeric(10,4)", nullable: false),
                    end_x = table.Column<decimal>(type: "numeric(10,4)", nullable: false),
                    end_z = table.Column<decimal>(type: "numeric(10,4)", nullable: false),
                    thickness = table.Column<decimal>(type: "numeric(6,3)", nullable: false),
                    height = table.Column<decimal>(type: "numeric(6,3)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_walls", x => x.id);
                    table.ForeignKey(
                        name: "fk_walls_projects_project_id",
                        column: x => x.project_id,
                        principalTable: "projects",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "openings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    project_id = table.Column<Guid>(type: "uuid", nullable: false),
                    wall_id = table.Column<Guid>(type: "uuid", nullable: false),
                    type = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    offset_from_start = table.Column<decimal>(type: "numeric(10,4)", nullable: false),
                    width = table.Column<decimal>(type: "numeric(6,3)", nullable: false),
                    height = table.Column<decimal>(type: "numeric(6,3)", nullable: false),
                    sill_height = table.Column<decimal>(type: "numeric(6,3)", nullable: false),
                    product_variant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    material_overrides = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_openings", x => x.id);
                    table.ForeignKey(
                        name: "fk_openings_product_variants_product_variant_id",
                        column: x => x.product_variant_id,
                        principalTable: "product_variants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_openings_projects_project_id",
                        column: x => x.project_id,
                        principalTable: "projects",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_openings_walls_wall_id",
                        column: x => x.wall_id,
                        principalTable: "walls",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_floors_project_id",
                table: "floors",
                column: "project_id");

            migrationBuilder.CreateIndex(
                name: "ix_openings_product_variant_id",
                table: "openings",
                column: "product_variant_id");

            migrationBuilder.CreateIndex(
                name: "ix_openings_project_id",
                table: "openings",
                column: "project_id");

            migrationBuilder.CreateIndex(
                name: "ix_openings_wall_id",
                table: "openings",
                column: "wall_id");

            migrationBuilder.CreateIndex(
                name: "ix_placed_items_product_variant_id",
                table: "placed_items",
                column: "product_variant_id");

            migrationBuilder.CreateIndex(
                name: "ix_placed_items_project_id",
                table: "placed_items",
                column: "project_id");

            migrationBuilder.CreateIndex(
                name: "ix_project_versions_project_id_created_at",
                table: "project_versions",
                columns: new[] { "project_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_projects_owner_user_id_deleted_at_updated_at",
                table: "projects",
                columns: new[] { "owner_user_id", "deleted_at", "updated_at" });

            migrationBuilder.CreateIndex(
                name: "ix_projects_thumbnail_asset_id",
                table: "projects",
                column: "thumbnail_asset_id");

            migrationBuilder.CreateIndex(
                name: "ix_walls_project_id",
                table: "walls",
                column: "project_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "floors");

            migrationBuilder.DropTable(
                name: "openings");

            migrationBuilder.DropTable(
                name: "placed_items");

            migrationBuilder.DropTable(
                name: "project_versions");

            migrationBuilder.DropTable(
                name: "walls");

            migrationBuilder.DropTable(
                name: "projects");
        }
    }
}
