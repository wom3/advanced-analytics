import { createClient } from "redis";

const GROUP_PREFIXES = {
  "llama.metrics": ["aa:v1:http:/api/v1/llama/metrics/"],
  "coingecko.market": ["aa:v1:http:/api/v1/coingecko/market/"],
  "fng.latest": ["aa:v1:http:/api/v1/fng/latest"],
  "fng.history": ["aa:v1:http:/api/v1/fng/history"],
  "sentiment.score": ["aa:v1:http:/api/v1/sentiment/score"],
  "sentiment.history": ["aa:v1:http:/api/v1/sentiment/history"],
  "dashboard.overview": ["aa:v1:http:/api/v1/dashboard/overview"],
};

const ALL_GROUPS = Object.keys(GROUP_PREFIXES);

async function unlinkByPrefix(client, prefix) {
  let removed = 0;
  const BATCH_SIZE = 200;
  const batch = [];

  for await (const chunk of client.scanIterator({ MATCH: `${prefix}*`, COUNT: BATCH_SIZE })) {
    const keys = Array.isArray(chunk) ? chunk : [chunk];
    for (const key of keys) {
      if (!key) {
        continue;
      }
      batch.push(key);
    }

    if (batch.length >= BATCH_SIZE) {
      const result = await client.sendCommand(["UNLINK", ...batch]);
      const numeric = Number(result);
      if (Number.isFinite(numeric)) {
        removed += numeric;
      }
      batch.length = 0;
    }
  }

  if (batch.length > 0) {
    const result = await client.sendCommand(["UNLINK", ...batch]);
    const numeric = Number(result);
    if (Number.isFinite(numeric)) {
      removed += numeric;
    }
  }

  return removed;
}

async function main() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.error("REDIS_URL is required to invalidate cache.");
    process.exit(1);
  }

  const inputGroups = process.argv.slice(2);
  const groups = inputGroups.length ? inputGroups : ALL_GROUPS;

  const invalid = groups.filter((group) => !(group in GROUP_PREFIXES));
  if (invalid.length) {
    console.error(`Unknown cache group(s): ${invalid.join(", ")}`);
    console.error(`Allowed groups: ${ALL_GROUPS.join(", ")}`);
    process.exit(1);
  }

  const client = createClient({ url: redisUrl });
  client.on("error", (error) => {
    console.error(`Redis error: ${error.message}`);
  });

  await client.connect();

  let total = 0;
  for (const group of groups) {
    for (const prefix of GROUP_PREFIXES[group]) {
      total += await unlinkByPrefix(client, prefix);
    }
  }

  await client.close();
  console.log(`Invalidated cache keys: ${total}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
