using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Dizajno.Api;

/// <summary>
/// Turns an unhandled exception into an RFC 7807 <see cref="ProblemDetails"/>
/// response instead of whatever the pipeline would otherwise produce.
/// </summary>
/// <remarks>
/// Without this the API had two failure modes the client could not parse: in
/// Development the framework returns the developer exception <em>HTML page</em>,
/// and in Production an empty 500 with no body at all. The client used to paste
/// the HTML document straight into an error banner.
/// <para>
/// The exception message is logged, never returned — it can name internal paths,
/// SQL, and configuration keys. The <c>traceId</c> is the only thing the caller
/// gets, which is enough to correlate a user report with the log entry.
/// </para>
/// </remarks>
public sealed class UnhandledExceptionHandler : IExceptionHandler
{
    private readonly ILogger<UnhandledExceptionHandler> _logger;

    public UnhandledExceptionHandler(ILogger<UnhandledExceptionHandler> logger)
    {
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var traceId = httpContext.TraceIdentifier;

        _logger.LogError(
            exception,
            "Unhandled exception for {Method} {Path} (traceId {TraceId})",
            httpContext.Request.Method,
            httpContext.Request.Path,
            traceId);

        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status500InternalServerError,
            Title = "Unexpected server error",
            Detail = "The request could not be completed. Quote the reference below if you report this.",
        };
        problem.Extensions["traceId"] = traceId;

        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await httpContext.Response.WriteAsJsonAsync(problem, cancellationToken);
        return true;
    }
}
