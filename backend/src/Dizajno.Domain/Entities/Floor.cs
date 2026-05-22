namespace Dizajno.Domain.Entities;

public sealed class Floor
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    /// <summary>jsonb array of <c>[x, z]</c> tuples forming the floor polygon.</summary>
    public string Vertices { get; set; } = "[]";

    public Project Project { get; set; } = null!;
}
