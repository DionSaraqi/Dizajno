using Dizajno.Infrastructure;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

const string FrontendCorsPolicy = "FrontendDev";

var connectionString = builder.Configuration.GetConnectionString("Dizajno")
    ?? throw new InvalidOperationException(
        "ConnectionStrings:Dizajno is not configured. Set it in appsettings.Development.json " +
        "or via the DIZAJNO_ConnectionStrings__Dizajno environment variable.");

builder.Services.AddInfrastructure(connectionString);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Dizajno API",
        Version = "v1",
        Description = "Backend API for the Dizajno room designer marketplace."
    });
});

builder.Services.AddCors(options =>
{
    options.AddPolicy(FrontendCorsPolicy, policy => policy
        .WithOrigins(
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:3002")
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials());
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "Dizajno API v1");
        options.RoutePrefix = "swagger";
    });

    app.MapGet("/", () => Results.Redirect("/swagger"));
}

app.UseCors(FrontendCorsPolicy);
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new
{
    status = "ok",
    service = "dizajno-api",
    timeUtc = DateTime.UtcNow
}));

app.MapControllers();

app.Run();
