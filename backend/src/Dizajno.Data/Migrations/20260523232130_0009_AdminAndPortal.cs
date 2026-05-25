using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dizajno.Data.Migrations
{
    /// <inheritdoc />
    public partial class _0009_AdminAndPortal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "is_trusted",
                table: "suppliers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "suspended_at",
                table: "suppliers",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "cancellation_reason",
                table: "quote_requests",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "status",
                table: "categories",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "Approved");

            migrationBuilder.AddColumn<Guid>(
                name: "suggested_by_supplier_id",
                table: "categories",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "audit_log",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    actor_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    action = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    entity_type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    diff = table.Column<string>(type: "jsonb", nullable: true),
                    ip_address = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    user_agent = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_audit_log", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "supplier_invites",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    supplier_id = table.Column<Guid>(type: "uuid", nullable: false),
                    role = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    invited_email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    token_hash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    accepted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    accepted_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    revoked_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_supplier_invites", x => x.id);
                    table.ForeignKey(
                        name: "fk_supplier_invites_suppliers_supplier_id",
                        column: x => x.supplier_id,
                        principalTable: "suppliers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_suppliers_suspended_at",
                table: "suppliers",
                column: "suspended_at");

            migrationBuilder.CreateIndex(
                name: "ix_categories_status",
                table: "categories",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_categories_suggested_by_supplier_id",
                table: "categories",
                column: "suggested_by_supplier_id");

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_action_created_at",
                table: "audit_log",
                columns: new[] { "action", "created_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_actor_user_id_created_at",
                table: "audit_log",
                columns: new[] { "actor_user_id", "created_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_entity_type_entity_id_created_at",
                table: "audit_log",
                columns: new[] { "entity_type", "entity_id", "created_at" },
                descending: new[] { false, false, true });

            migrationBuilder.CreateIndex(
                name: "ix_supplier_invites_supplier_id_accepted_at_revoked_at",
                table: "supplier_invites",
                columns: new[] { "supplier_id", "accepted_at", "revoked_at" });

            migrationBuilder.CreateIndex(
                name: "ix_supplier_invites_token_hash",
                table: "supplier_invites",
                column: "token_hash",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "fk_categories_suppliers_suggested_by_supplier_id",
                table: "categories",
                column: "suggested_by_supplier_id",
                principalTable: "suppliers",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            // The Phase-1 seed supplier becomes trusted automatically so its
            // 20 seeded products keep auto-publishing in existing dev DBs.
            // New suppliers default to is_trusted = false and have to be
            // promoted by an admin once their first product passes review.
            migrationBuilder.Sql("UPDATE suppliers SET is_trusted = true WHERE slug = 'dizajno';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_categories_suppliers_suggested_by_supplier_id",
                table: "categories");

            migrationBuilder.DropTable(
                name: "audit_log");

            migrationBuilder.DropTable(
                name: "supplier_invites");

            migrationBuilder.DropIndex(
                name: "ix_suppliers_suspended_at",
                table: "suppliers");

            migrationBuilder.DropIndex(
                name: "ix_categories_status",
                table: "categories");

            migrationBuilder.DropIndex(
                name: "ix_categories_suggested_by_supplier_id",
                table: "categories");

            migrationBuilder.DropColumn(
                name: "is_trusted",
                table: "suppliers");

            migrationBuilder.DropColumn(
                name: "suspended_at",
                table: "suppliers");

            migrationBuilder.DropColumn(
                name: "cancellation_reason",
                table: "quote_requests");

            migrationBuilder.DropColumn(
                name: "status",
                table: "categories");

            migrationBuilder.DropColumn(
                name: "suggested_by_supplier_id",
                table: "categories");
        }
    }
}
