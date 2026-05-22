namespace Dizajno.Domain.Entities;

public sealed class Project
{
    public Guid Id { get; set; }
    public Guid OwnerUserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public Guid? ThumbnailAssetId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }

    public Asset? ThumbnailAsset { get; set; }
    public ICollection<Wall> Walls { get; set; } = new List<Wall>();
    public ICollection<Floor> Floors { get; set; } = new List<Floor>();
    public ICollection<Opening> Openings { get; set; } = new List<Opening>();
    public ICollection<PlacedItem> PlacedItems { get; set; } = new List<PlacedItem>();
    public ICollection<ProjectVersion> Versions { get; set; } = new List<ProjectVersion>();
}
