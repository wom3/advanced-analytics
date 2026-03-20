const DEFAULT_BASE_URL = "http://localhost:3000";

const REFRESH_TARGETS = [
  { name: "fng-latest", path: "/api/v1/fng/latest" },
  { name: "fng-history", path: "/api/v1/fng/history?limit=30" },
  { name: "llama-tvl", path: "/api/v1/llama/metrics/tvl?chain=Ethereum&interval=1d" },
  { name: "coingecko-btc", path: "/api/v1/coingecko/market/bitcoin?interval=1d" },
  { name: "sentiment-score", path: "/api/v1/sentiment/score?mode=live&interval=1h&points=72" },
  {
    name: "sentiment-history",
    path: "/api/v1/sentiment/history?mode=live&interval=1h&points=72",
  },
  {
    name: "dashboard-overview",
    path: "/api/v1/dashboard/overview?mode=live&interval=1h&points=72",
  },
];

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.REFRESH_BASE_URL || DEFAULT_BASE_URL,
    timeoutMs: Number(process.env.REFRESH_TIMEOUT_MS || 20_000),
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    if (token === "--base-url") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--base-url requires a value.");
      }
      args.baseUrl = value;
      index += 1;
      continue;
    }

    if (token === "--timeout-ms") {
      const value = Number(argv[index + 1]);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("--timeout-ms must be a positive number.");
      }
      args.timeoutMs = value;
      index += 1;
      continue;
    }

    if (token === "--help" || token === "-h") {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

function printHelp() {
  console.log("Refresh local API data caches by calling key /api/v1 endpoints.");
  console.log("");
  console.log("Usage:");
  console.log("  node scripts/refresh-data.mjs [--dry-run] [--base-url URL] [--timeout-ms MS]");
  console.log("");
  console.log("Environment:");
  console.log("  REFRESH_BASE_URL    Base URL override (default: http://localhost:3000)");
  console.log("  REFRESH_TIMEOUT_MS  HTTP timeout in milliseconds (default: 20000)");
}

function normalizeBaseUrl(input) {
  return input.endsWith("/") ? input.slice(0, -1) : input;
}

function asErrorMessage(value) {
  return value instanceof Error ? value.message : String(value);
}

async function refreshTarget(baseUrl, target, timeoutMs) {
  const url = `${baseUrl}${target.path}`;
  const startedAt = Date.now();

  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      "user-agent": "aa-local-refresh/1.0",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });

  const durationMs = Date.now() - startedAt;
  const isJson = (response.headers.get("content-type") || "").includes("application/json");
  const payload = isJson ? await response.json().catch(() => null) : null;

  return {
    ok: response.ok,
    status: response.status,
    durationMs,
    url,
    payload,
    requestId: response.headers.get("x-request-id") || undefined,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(args.baseUrl);

  if (args.dryRun) {
    console.log(`[refresh-data] dry run mode. baseUrl=${baseUrl}`);
    for (const target of REFRESH_TARGETS) {
      console.log(`[refresh-data] would call ${target.name} -> ${baseUrl}${target.path}`);
    }
    return;
  }

  console.log(`[refresh-data] starting refresh cycle against ${baseUrl}`);
  let failed = 0;

  for (const target of REFRESH_TARGETS) {
    try {
      const result = await refreshTarget(baseUrl, target, args.timeoutMs);
      const requestIdSegment = result.requestId ? ` requestId=${result.requestId}` : "";

      if (result.ok) {
        console.log(
          `[refresh-data] ok ${target.name} status=${result.status} durationMs=${result.durationMs}${requestIdSegment}`
        );
      } else {
        failed += 1;
        const message =
          typeof result.payload?.error?.message === "string"
            ? result.payload.error.message
            : "non-2xx response";
        console.error(
          `[refresh-data] failed ${target.name} status=${result.status} message=${message}${requestIdSegment}`
        );
      }
    } catch (error) {
      failed += 1;
      console.error(`[refresh-data] failed ${target.name} error=${asErrorMessage(error)}`);
    }
  }

  if (failed > 0) {
    throw new Error(`Refresh cycle completed with ${failed} failing target(s).`);
  }

  console.log(
    `[refresh-data] refresh cycle completed successfully (${REFRESH_TARGETS.length} targets).`
  );
}

main().catch((error) => {
  console.error(`[refresh-data] ${asErrorMessage(error)}`);
  process.exit(1);
});
