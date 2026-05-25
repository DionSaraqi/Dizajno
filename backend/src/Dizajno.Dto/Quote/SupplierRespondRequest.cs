using System.ComponentModel.DataAnnotations;

namespace Dizajno.Dto.Quote;

public sealed record SupplierRespondRequest(
    [Range(0, double.MaxValue)] decimal TotalPrice,
    [Required, MinLength(3), MaxLength(3)] string Currency,
    string? Body,
    IReadOnlyList<Guid>? AttachmentAssetIds);
