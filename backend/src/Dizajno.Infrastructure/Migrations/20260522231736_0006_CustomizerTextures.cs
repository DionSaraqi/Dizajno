using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dizajno.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class _0006_CustomizerTextures : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "supplier_textures",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    supplier_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    asset_id = table.Column<Guid>(type: "uuid", nullable: false),
                    thumbnail_asset_id = table.Column<Guid>(type: "uuid", nullable: true),
                    tags = table.Column<string[]>(type: "text[]", nullable: false),
                    repeat_u = table.Column<int>(type: "integer", nullable: false, defaultValue: 4),
                    repeat_v = table.Column<int>(type: "integer", nullable: false, defaultValue: 4),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_supplier_textures", x => x.id);
                    table.ForeignKey(
                        name: "fk_supplier_textures_assets_asset_id",
                        column: x => x.asset_id,
                        principalTable: "assets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_supplier_textures_assets_thumbnail_asset_id",
                        column: x => x.thumbnail_asset_id,
                        principalTable: "assets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_supplier_textures_suppliers_supplier_id",
                        column: x => x.supplier_id,
                        principalTable: "suppliers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "product_variant_texture_slots",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    variant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    slot_name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    supplier_texture_id = table.Column<Guid>(type: "uuid", nullable: false),
                    is_default = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_product_variant_texture_slots", x => x.id);
                    table.ForeignKey(
                        name: "fk_product_variant_texture_slots_product_variants_variant_id",
                        column: x => x.variant_id,
                        principalTable: "product_variants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_product_variant_texture_slots_supplier_textures_supplier_te",
                        column: x => x.supplier_texture_id,
                        principalTable: "supplier_textures",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_product_variant_texture_slots_supplier_texture_id",
                table: "product_variant_texture_slots",
                column: "supplier_texture_id");

            migrationBuilder.CreateIndex(
                name: "ix_product_variant_texture_slots_variant_id_slot_name",
                table: "product_variant_texture_slots",
                columns: new[] { "variant_id", "slot_name" });

            migrationBuilder.CreateIndex(
                name: "ix_supplier_textures_asset_id",
                table: "supplier_textures",
                column: "asset_id");

            migrationBuilder.CreateIndex(
                name: "ix_supplier_textures_supplier_id_name",
                table: "supplier_textures",
                columns: new[] { "supplier_id", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_supplier_textures_thumbnail_asset_id",
                table: "supplier_textures",
                column: "thumbnail_asset_id");

            // A variant's product must belong to the same supplier as any texture attached
            // to one of its slots. Enforced at the DB level so cross-supplier assignments
            // can never sneak in via direct SQL or bulk loads.
            migrationBuilder.Sql(@"
CREATE OR REPLACE FUNCTION ensure_pv_texture_slot_supplier_match() RETURNS trigger AS $$
DECLARE
    variant_supplier uuid;
    texture_supplier uuid;
BEGIN
    SELECT p.supplier_id INTO variant_supplier
      FROM product_variants v
      JOIN products p ON p.id = v.product_id
      WHERE v.id = NEW.variant_id;

    SELECT supplier_id INTO texture_supplier
      FROM supplier_textures
      WHERE id = NEW.supplier_texture_id;

    IF variant_supplier IS NULL THEN
        RAISE EXCEPTION 'product_variant_texture_slots: variant % not found', NEW.variant_id;
    END IF;
    IF texture_supplier IS NULL THEN
        RAISE EXCEPTION 'product_variant_texture_slots: supplier_texture % not found', NEW.supplier_texture_id;
    END IF;
    IF variant_supplier <> texture_supplier THEN
        RAISE EXCEPTION 'product_variant_texture_slots: variant supplier % does not match texture supplier %', variant_supplier, texture_supplier;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pv_texture_slot_supplier_match
    BEFORE INSERT OR UPDATE ON product_variant_texture_slots
    FOR EACH ROW EXECUTE FUNCTION ensure_pv_texture_slot_supplier_match();
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DROP TRIGGER IF EXISTS trg_pv_texture_slot_supplier_match ON product_variant_texture_slots;
DROP FUNCTION IF EXISTS ensure_pv_texture_slot_supplier_match();
");

            migrationBuilder.DropTable(
                name: "product_variant_texture_slots");

            migrationBuilder.DropTable(
                name: "supplier_textures");
        }
    }
}
