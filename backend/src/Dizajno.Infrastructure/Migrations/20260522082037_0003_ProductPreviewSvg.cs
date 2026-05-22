using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dizajno.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class _0003_ProductPreviewSvg : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "preview_svg",
                table: "products",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "preview_svg",
                table: "products");
        }
    }
}
