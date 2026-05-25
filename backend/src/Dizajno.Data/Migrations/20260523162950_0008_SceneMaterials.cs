using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dizajno.Data.Migrations
{
    /// <inheritdoc />
    public partial class _0008_SceneMaterials : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "paint_product_variant_id",
                table: "walls",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "texture_url",
                table: "products",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "flooring_product_variant_id",
                table: "floors",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_walls_paint_product_variant_id",
                table: "walls",
                column: "paint_product_variant_id");

            migrationBuilder.CreateIndex(
                name: "ix_floors_flooring_product_variant_id",
                table: "floors",
                column: "flooring_product_variant_id");

            migrationBuilder.AddForeignKey(
                name: "fk_floors_product_variants_flooring_product_variant_id",
                table: "floors",
                column: "flooring_product_variant_id",
                principalTable: "product_variants",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "fk_walls_product_variants_paint_product_variant_id",
                table: "walls",
                column: "paint_product_variant_id",
                principalTable: "product_variants",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_floors_product_variants_flooring_product_variant_id",
                table: "floors");

            migrationBuilder.DropForeignKey(
                name: "fk_walls_product_variants_paint_product_variant_id",
                table: "walls");

            migrationBuilder.DropIndex(
                name: "ix_walls_paint_product_variant_id",
                table: "walls");

            migrationBuilder.DropIndex(
                name: "ix_floors_flooring_product_variant_id",
                table: "floors");

            migrationBuilder.DropColumn(
                name: "paint_product_variant_id",
                table: "walls");

            migrationBuilder.DropColumn(
                name: "texture_url",
                table: "products");

            migrationBuilder.DropColumn(
                name: "flooring_product_variant_id",
                table: "floors");
        }
    }
}
