using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dizajno.Data.Migrations
{
    /// <inheritdoc />
    public partial class _0005_Sharing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "project_shares",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    project_id = table.Column<Guid>(type: "uuid", nullable: false),
                    mode = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    token = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    invited_email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    invited_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    revoked_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_project_shares", x => x.id);
                    table.CheckConstraint("ck_project_shares_recipient", "(token IS NOT NULL)::int + (invited_email IS NOT NULL)::int + (invited_user_id IS NOT NULL)::int = 1");
                    table.ForeignKey(
                        name: "fk_project_shares_projects_project_id",
                        column: x => x.project_id,
                        principalTable: "projects",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "project_comments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    project_id = table.Column<Guid>(type: "uuid", nullable: false),
                    parent_comment_id = table.Column<Guid>(type: "uuid", nullable: true),
                    author_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    guest_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    guest_email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    share_id = table.Column<Guid>(type: "uuid", nullable: true),
                    body = table.Column<string>(type: "text", nullable: false),
                    anchor = table.Column<string>(type: "jsonb", nullable: true),
                    resolved_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_project_comments", x => x.id);
                    table.ForeignKey(
                        name: "fk_project_comments_project_comments_parent_comment_id",
                        column: x => x.parent_comment_id,
                        principalTable: "project_comments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_project_comments_project_shares_share_id",
                        column: x => x.share_id,
                        principalTable: "project_shares",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_project_comments_projects_project_id",
                        column: x => x.project_id,
                        principalTable: "projects",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_project_comments_parent_comment_id",
                table: "project_comments",
                column: "parent_comment_id");

            migrationBuilder.CreateIndex(
                name: "ix_project_comments_project_id_created_at",
                table: "project_comments",
                columns: new[] { "project_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_project_comments_share_id",
                table: "project_comments",
                column: "share_id");

            migrationBuilder.CreateIndex(
                name: "ix_project_shares_project_id_revoked_at",
                table: "project_shares",
                columns: new[] { "project_id", "revoked_at" });

            migrationBuilder.CreateIndex(
                name: "ix_project_shares_token",
                table: "project_shares",
                column: "token",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "project_comments");

            migrationBuilder.DropTable(
                name: "project_shares");
        }
    }
}
