namespace Dizajno.Domain.Entities;

public sealed class ProjectVersion
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public string Label { get; set; } = string.Empty;
    /// <summary>
    /// Full scene state frozen at the moment the user named the version.
    /// Restored via <c>POST /api/projects/{id}/versions/{versionId}/restore</c>.
    /// </summary>
    public string SceneSnapshot { get; set; } = "{}";
    public Guid CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }

    public Project Project { get; set; } = null!;
}
