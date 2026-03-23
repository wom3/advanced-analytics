import assert from "node:assert/strict";
import test from "node:test";

import {
  executeQueryById,
  getExecutionResults,
  getExecutionStatus,
} from "@/src/server/adapters/dune/client";
import { createJsonResponse, withMockedFetch } from "@/src/test/support/fetch";

test("normalizes Dune execution status", async () => {
  const calls: Array<{ input: string; headers: Headers }> = [];

  const result = await withMockedFetch(
    async (input, init) => {
      calls.push({
        input: String(input),
        headers: new Headers(init?.headers),
      });

      return createJsonResponse({
        execution_id: "exec_123",
        query_id: 456,
        state: "QUERY_STATE_EXECUTING",
        is_execution_finished: false,
        submitted_at: "2026-01-01T00:00:00.000Z",
      });
    },
    async () => getExecutionStatus("exec_123")
  );

  assert.match(calls[0]?.input ?? "", /\/execution\/exec_123\/status$/);
  assert.equal(calls[0]?.headers.get("x-dune-api-key"), "test-key");
  assert.deepEqual(result, {
    executionId: "exec_123",
    queryId: 456,
    state: "QUERY_STATE_EXECUTING",
    isExecutionFinished: false,
    submittedAt: "2026-01-01T00:00:00.000Z",
    executionStartedAt: null,
    executionEndedAt: null,
    expiresAt: null,
    error: null,
  });
});

test("normalizes Dune execution results", async () => {
  const results = await withMockedFetch(
    async () =>
      createJsonResponse({
        execution_id: "exec_123",
        query_id: 456,
        state: "QUERY_STATE_COMPLETED",
        is_execution_finished: true,
        result: {
          metadata: {
            column_names: ["protocol", "volume_usd"],
            column_types: ["varchar", "double"],
            row_count: 1,
            total_row_count: 10,
          },
          rows: [{ protocol: "uniswap", volume_usd: 123.45 }],
          update_type: "append",
        },
        next_offset: 100,
        next_uri: "/next",
      }),
    async () => getExecutionResults("exec_123", { limit: 100, offset: 0 })
  );

  assert.equal(results.executionId, "exec_123");
  assert.deepEqual(results.columns, [
    { name: "protocol", type: "varchar" },
    { name: "volume_usd", type: "double" },
  ]);
  assert.deepEqual(results.rows, [{ protocol: "uniswap", volume_usd: 123.45 }]);
  assert.equal(results.rowCount, 1);
  assert.equal(results.totalRowCount, 10);
  assert.equal(results.updateType, "append");
});

test("sends Dune execute payload with optional query parameters", async () => {
  const calls: Array<{ input: string; body: string | null }> = [];

  const result = await withMockedFetch(
    async (input, init) => {
      calls.push({
        input: String(input),
        body: typeof init?.body === "string" ? init.body : null,
      });

      return createJsonResponse({
        execution_id: "exec_999",
        state: "QUERY_STATE_PENDING",
      });
    },
    async () =>
      executeQueryById(789, {
        performance: "large",
        queryParameters: {
          chain: "ethereum",
        },
      })
  );

  assert.match(calls[0]?.input ?? "", /\/query\/789\/execute$/);
  assert.match(calls[0]?.body ?? "", /"performance":"large"/);
  assert.match(calls[0]?.body ?? "", /"chain":"ethereum"/);
  assert.deepEqual(result, {
    executionId: "exec_999",
    state: "QUERY_STATE_PENDING",
  });
});
