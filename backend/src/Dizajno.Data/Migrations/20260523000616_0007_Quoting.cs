using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dizajno.Data.Migrations
{
    /// <inheritdoc />
    public partial class _0007_Quoting : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "quotes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    project_id = table.Column<Guid>(type: "uuid", nullable: false),
                    requester_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    message = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    closed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_quotes", x => x.id);
                    table.ForeignKey(
                        name: "fk_quotes_projects_project_id",
                        column: x => x.project_id,
                        principalTable: "projects",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "quote_requests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    quote_id = table.Column<Guid>(type: "uuid", nullable: false),
                    supplier_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_quote_requests", x => x.id);
                    table.ForeignKey(
                        name: "fk_quote_requests_quotes_quote_id",
                        column: x => x.quote_id,
                        principalTable: "quotes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_quote_requests_suppliers_supplier_id",
                        column: x => x.supplier_id,
                        principalTable: "suppliers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "quote_lines",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    quote_request_id = table.Column<Guid>(type: "uuid", nullable: false),
                    product_variant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    variant_snapshot = table.Column<string>(type: "jsonb", nullable: false),
                    quantity = table.Column<decimal>(type: "numeric(12,3)", nullable: false, defaultValue: 1m),
                    quantity_unit = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    material_overrides = table.Column<string>(type: "jsonb", nullable: true),
                    scaled_width = table.Column<decimal>(type: "numeric(8,3)", nullable: true),
                    scaled_depth = table.Column<decimal>(type: "numeric(8,3)", nullable: true),
                    scaled_height = table.Column<decimal>(type: "numeric(8,3)", nullable: true),
                    is_custom_size = table.Column<bool>(type: "boolean", nullable: false),
                    suggested_price = table.Column<decimal>(type: "numeric(12,2)", nullable: true),
                    currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_quote_lines", x => x.id);
                    table.ForeignKey(
                        name: "fk_quote_lines_product_variants_product_variant_id",
                        column: x => x.product_variant_id,
                        principalTable: "product_variants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_quote_lines_quote_requests_quote_request_id",
                        column: x => x.quote_request_id,
                        principalTable: "quote_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "quote_responses",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    quote_request_id = table.Column<Guid>(type: "uuid", nullable: false),
                    responded_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    total_price = table.Column<decimal>(type: "numeric(14,2)", nullable: false),
                    currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    body = table.Column<string>(type: "text", nullable: true),
                    responded_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_quote_responses", x => x.id);
                    table.ForeignKey(
                        name: "fk_quote_responses_quote_requests_quote_request_id",
                        column: x => x.quote_request_id,
                        principalTable: "quote_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "quote_response_assets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    response_id = table.Column<Guid>(type: "uuid", nullable: false),
                    asset_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_quote_response_assets", x => x.id);
                    table.ForeignKey(
                        name: "fk_quote_response_assets_assets_asset_id",
                        column: x => x.asset_id,
                        principalTable: "assets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_quote_response_assets_quote_responses_response_id",
                        column: x => x.response_id,
                        principalTable: "quote_responses",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_quote_lines_product_variant_id",
                table: "quote_lines",
                column: "product_variant_id");

            migrationBuilder.CreateIndex(
                name: "ix_quote_lines_quote_request_id",
                table: "quote_lines",
                column: "quote_request_id");

            migrationBuilder.CreateIndex(
                name: "ix_quote_requests_quote_id_supplier_id",
                table: "quote_requests",
                columns: new[] { "quote_id", "supplier_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_quote_requests_supplier_id_status_created_at",
                table: "quote_requests",
                columns: new[] { "supplier_id", "status", "created_at" },
                descending: new[] { false, false, true });

            migrationBuilder.CreateIndex(
                name: "ix_quote_response_assets_asset_id",
                table: "quote_response_assets",
                column: "asset_id");

            migrationBuilder.CreateIndex(
                name: "ix_quote_response_assets_response_id_sort_order",
                table: "quote_response_assets",
                columns: new[] { "response_id", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "ix_quote_responses_quote_request_id",
                table: "quote_responses",
                column: "quote_request_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_quotes_project_id",
                table: "quotes",
                column: "project_id");

            migrationBuilder.CreateIndex(
                name: "ix_quotes_requester_user_id_created_at",
                table: "quotes",
                columns: new[] { "requester_user_id", "created_at" },
                descending: new[] { false, true });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "quote_lines");

            migrationBuilder.DropTable(
                name: "quote_response_assets");

            migrationBuilder.DropTable(
                name: "quote_responses");

            migrationBuilder.DropTable(
                name: "quote_requests");

            migrationBuilder.DropTable(
                name: "quotes");
        }
    }
}
