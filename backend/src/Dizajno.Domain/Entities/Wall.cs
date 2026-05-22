namespace Dizajno.Domain.Entities;

public sealed class Wall
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public decimal StartX { get; set; }
    public decimal StartZ { get; set; }
    public decimal EndX { get; set; }
    public decimal EndZ { get; set; }
    public decimal Thickness { get; set; }
    public decimal Height { get; set; }

    public Project Project { get; set; } = null!;
}
