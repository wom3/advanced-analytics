import assert from "node:assert/strict";
import test from "node:test";

import { buildDashboardOverview } from "@/src/server/services/dashboard/service";

test("builds dashboard overview in demo mode with provider status and history", async () => {
  const overview = await buildDashboardOverview({
    mode: "demo",
    interval: "1h",
    points: 48,
  });

  assert.equal(overview.providerStatus.length, 3);
  assert.ok(overview.providerStatus.every((provider) => provider.fallback));
  assert.ok(overview.history.length >= 24);
  assert.ok(Number.isFinite(overview.score.score));
  assert.ok(["bullish", "neutral", "bearish"].includes(overview.score.label));
  assert.ok(overview.freshnessSec >= 0);
  assert.ok(overview.featureFactorIds.length >= 4);
});
