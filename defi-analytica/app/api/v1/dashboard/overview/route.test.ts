import assert from "node:assert/strict";
import test from "node:test";

import { GET } from "@/app/api/v1/dashboard/overview/route";
import { createApiRequest } from "@/src/test/support/next";

test("dashboard overview route preserves request id and sets rate limit headers", async () => {
  const response = await GET(
    createApiRequest("/api/v1/dashboard/overview?mode=demo&interval=1h&points=48", {
      requestId: "req-dashboard-overview",
    })
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-request-id"), "req-dashboard-overview");
  assert.ok(response.headers.get("x-ratelimit-remaining"));
  assert.ok(response.headers.get("x-ratelimit-reset"));

  const body = await response.json();
  assert.equal(body.meta.mode, "demo");
  assert.equal(body.meta.points, 48);
  assert.equal(body.data.history.length, 48);
  assert.equal(body.data.providerStatus.length, 3);
});

test("dashboard overview route returns a 400 envelope for invalid point ranges", async () => {
  const response = await GET(
    createApiRequest("/api/v1/dashboard/overview?mode=demo&interval=1h&points=8")
  );

  assert.equal(response.status, 400);

  const body = await response.json();
  assert.equal(body.code, "DASHBOARD_OVERVIEW_FAILED");
  assert.equal(body.retryable, false);
  assert.match(body.message, /points must be an integer between 24 and 720/);
});
