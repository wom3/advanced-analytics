import assert from "node:assert/strict";
import test from "node:test";

import {
  AlternativeApiError,
  getFearGreedHistory,
  getFearGreedLatest,
} from "@/src/server/adapters/alternative/client";
import { createJsonResponse, withMockedFetch } from "@/src/test/support/fetch";

test("normalizes latest fear and greed response", async () => {
  const calls: string[] = [];

  const latest = await withMockedFetch(
    async (input) => {
      calls.push(String(input));

      return createJsonResponse({
        data: [
          {
            value: "73",
            value_classification: "Greed",
            timestamp: "1710000000",
            time_until_update: "-5",
          },
        ],
        metadata: {
          error: null,
        },
      });
    },
    async () => getFearGreedLatest()
  );

  assert.match(calls[0] ?? "", /limit=1/);
  assert.deepEqual(latest, {
    timestamp: "2024-03-09T16:00:00.000Z",
    value: 73,
    classification: "Greed",
    timeUntilUpdateSec: 0,
  });
});

test("filters and sorts fear and greed history", async () => {
  const history = await withMockedFetch(
    async () =>
      createJsonResponse({
        data: [
          {
            value: "40",
            value_classification: "Fear",
            timestamp: "1710007200",
          },
          {
            value: "55",
            value_classification: "Neutral",
            timestamp: "1710003600",
          },
          {
            value: "bad",
            value_classification: "Ignore",
            timestamp: "1710000000",
          },
        ],
        metadata: {
          error: null,
        },
      }),
    async () =>
      getFearGreedHistory({
        limit: 10,
        sinceSec: 1710003600,
        untilSec: 1710007200,
      })
  );

  assert.deepEqual(history, [
    {
      timestamp: "2024-03-09T17:00:00.000Z",
      value: 55,
      classification: "Neutral",
      timeUntilUpdateSec: null,
    },
    {
      timestamp: "2024-03-09T18:00:00.000Z",
      value: 40,
      classification: "Fear",
      timeUntilUpdateSec: null,
    },
  ]);
});

test("rejects non-positive history limits", async () => {
  await assert.rejects(
    () => getFearGreedHistory({ limit: 0 }),
    (error: unknown) => {
      assert.ok(error instanceof AlternativeApiError);
      assert.equal(error.status, 400);
      assert.match(error.message, /positive integer/);
      return true;
    }
  );
});
