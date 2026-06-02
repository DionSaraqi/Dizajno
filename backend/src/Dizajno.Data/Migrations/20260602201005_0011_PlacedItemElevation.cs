using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dizajno.Data.Migrations
{
    /// <inheritdoc />
    public partial class _0011_PlacedItemElevation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "elevation",
                table: "placed_items",
                type: "numeric(10,4)",
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "elevation",
                table: "placed_items");
        }
    }
}
