// Global test environment bootstrap.
// Loaded before test files to ensure required env vars are present when running
// individual test files in isolation (e.g. from an IDE or via the CLI directly).
const testEnv = process.env as Record<string, string | undefined>;

testEnv["NODE_ENV"] ??= "test";
testEnv["DUNE_API_KEY"] ??= "test-key";
