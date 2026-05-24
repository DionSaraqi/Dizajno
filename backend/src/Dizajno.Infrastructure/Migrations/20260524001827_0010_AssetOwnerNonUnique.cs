using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dizajno.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class _0010_AssetOwnerNonUnique : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_assets_owner_supplier_id",
                table: "assets");

            migrationBuilder.CreateIndex(
                name: "ix_assets_owner_supplier_id",
                table: "assets",
                column: "owner_supplier_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_assets_owner_supplier_id",
                table: "assets");

            migrationBuilder.CreateIndex(
                name: "ix_assets_owner_supplier_id",
                table: "assets",
                column: "owner_supplier_id",
                unique: true);
        }
    }
}
