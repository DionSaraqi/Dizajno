// Disable parallel execution across test classes. Each class spins up its own
// Testcontainers Postgres instance via DizajnoApiFactory; running 5+ in parallel
// hits Docker Desktop's startup ceiling and produces 1-ms phantom failures.
// Sequential execution adds ~30 s to the full suite — acceptable for now.
[assembly: Xunit.CollectionBehavior(DisableTestParallelization = true)]
