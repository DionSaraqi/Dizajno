using System.Security.Claims;
using System.Text.Json;
using Dizajno.Application.Interfaces;
using Dizajno.Domain.Entities;
using Dizajno.Data;
using Microsoft.AspNetCore.Http;

namespace Dizajno.Infrastructure.Audit;

public sealed class AuditLogger : IAuditLogger
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = false,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly DizajnoDbContext _db;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public AuditLogger(DizajnoDbContext db, IHttpContextAccessor httpContextAccessor)
    {
        _db = db;
        _httpContextAccessor = httpContextAccessor;
    }

    public async Task LogAsync(
        string action,
        string entityType,
        Guid entityId,
        object? diff = null,
        CancellationToken cancellationToken = default)
    {
        var http = _httpContextAccessor.HttpContext;
        Guid? actorId = null;
        string? ip = null;
        string? ua = null;
        if (http is not null)
        {
            var sub = http.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (Guid.TryParse(sub, out var parsed)) actorId = parsed;
            ip = http.Connection.RemoteIpAddress?.ToString();
            if (http.Request.Headers.TryGetValue("User-Agent", out var uaHeader))
            {
                ua = uaHeader.ToString();
                if (ua.Length > 1024) ua = ua[..1024];
            }
        }

        _db.AuditLog.Add(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            ActorUserId = actorId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            Diff = diff is null ? null : JsonSerializer.Serialize(diff, JsonOptions),
            IpAddress = ip,
            UserAgent = ua,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync(cancellationToken);
    }
}
