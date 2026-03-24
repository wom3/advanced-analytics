// Global test environment bootstrap.
// Loaded before test files to ensure required env vars are present when running
// individual test files in isolation (e.g. from an IDE or via the CLI directly).
process.env.NODE_ENV ??= "test";
process.env.DUNE_API_KEY ??= "test-key";
