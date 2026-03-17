import { env } from "@/src/env";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DUNE_BASE_URL = "https://api.dune.com/api/v1";

export type DuneExecutionState =
  | "QUERY_STATE_PENDING"
  | "QUERY_STATE_EXECUTING"
  | "QUERY_STATE_COMPLETED"
  | "QUERY_STATE_COMPLETED_PARTIAL"
  | "QUERY_STATE_FAILED"
  | "QUERY_STATE_CANCELED"
  | "QUERY_STATE_EXPIRED"
  | string;

type DuneErrorPayload = {
  message?: string;
  type?: string;
  metadata?: Record<string, unknown>;
};

type DuneResultMetadata = {
  column_names?: string[];
  column_types?: string[];
  row_count?: number;
  total_row_count?: number;
  [key: string]: unknown;
};

type DuneApiResponse = {
  execution_id?: string;
  query_id?: number;
  state?: DuneExecutionState;
  is_execution_finished?: boolean;
  submitted_at?: string;
  execution_started_at?: string;
  execution_ended_at?: string;
  expires_at?: string;
  next_offset?: number;
  next_uri?: string;
  error?: DuneErrorPayload;
  result?: {
    metadata?: DuneResultMetadata;
    rows?: Array<Record<string, unknown>>;
    update_type?: string;
  };
};

export type DuneNormalizedStatus = {
  executionId: string;
  queryId: number | null;
  state: DuneExecutionState | null;
  isExecutionFinished: boolean | null;
  submittedAt: string | null;
  executionStartedAt: string | null;
  executionEndedAt: string | null;
  expiresAt: string | null;
  error: DuneErrorPayload | null;
};

export type DuneNormalizedResult = DuneNormalizedStatus & {
  nextOffset: number | null;
  nextUri: string | null;
  columns: Array<{ name: string; type: string | null }>;
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  totalRowCount: number | null;
  updateType: string | null;
};

export class DuneApiError extends Error {
  status: number;
  retryable: boolean;
  constructor(message: string, status = 500, retryable = true) {
    super(message);
    this.name = "DuneApiError";
    this.status = status;
    this.retryable = retryable;
  }
}

let cachedLocalDuneApiKey: string | null | undefined;

function parseDuneApiKeyFromEnvFile(content: string): string | undefined {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.startsWith("DUNE_API_KEY=")) {
      continue;
    }
    const raw = trimmed.slice("DUNE_API_KEY=".length).trim();
    const unquoted = raw.replace(/^['\"](.*)['\"]$/, "$1").trim();
    if (unquoted) {
      return unquoted;
    }
  }
  return undefined;
}

function getLocalDuneApiKey(): string | undefined {
  if (cachedLocalDuneApiKey !== undefined) {
    return cachedLocalDuneApiKey ?? undefined;
  }

  const candidates = [".env.local", ".env"];
  for (const filename of candidates) {
    const filePath = join(process.cwd(), filename);
    if (!existsSync(filePath)) {
      continue;
    }
    const parsed = parseDuneApiKeyFromEnvFile(readFileSync(filePath, "utf8"));
    if (parsed) {
      cachedLocalDuneApiKey = parsed;
      return parsed;
    }
  }

  cachedLocalDuneApiKey = null;
  return undefined;
}

function apiKey(): string {
  const runtimeKey = env.DUNE_API_KEY?.trim();
  if (process.env.NODE_ENV === "development") {
    const localFileKey = getLocalDuneApiKey();
    if (localFileKey) {
      return localFileKey;
    }
  }

  if (!runtimeKey) {
    throw new DuneApiError("Missing DUNE_API_KEY in server environment.", 500, false);
  }
  return runtimeKey;
}

function headers(): HeadersInit {
  return {
    "X-Dune-API-Key": apiKey(),
    "Content-Type": "application/json",
  };
}

function queryString(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) {
    return "";
  }
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }
    search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}

async function duneRequest<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  params?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  const url = `${DUNE_BASE_URL}${path}${queryString(params)}`;
  const response = await fetch(url, {
    method,
    headers: headers(),
    body: body === undefined ? null : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(120_000),
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new DuneApiError(
      `Dune returned a non-JSON response with status ${response.status}.`,
      response.status,
      response.status >= 500
    );
  }

  if (!response.ok) {
    const dunePayload = payload as { error?: DuneErrorPayload; message?: string };
    const message =
      dunePayload?.error?.message ||
      dunePayload?.message ||
      `Dune API request failed with status ${response.status}.`;
    throw new DuneApiError(
      message,
      response.status,
      response.status >= 500 || response.status === 429
    );
  }

  return payload as T;
}

function normalizeStatus(payload: DuneApiResponse): DuneNormalizedStatus {
  return {
    executionId: payload.execution_id ?? "",
    queryId: payload.query_id ?? null,
    state: payload.state ?? null,
    isExecutionFinished: payload.is_execution_finished ?? null,
    submittedAt: payload.submitted_at ?? null,
    executionStartedAt: payload.execution_started_at ?? null,
    executionEndedAt: payload.execution_ended_at ?? null,
    expiresAt: payload.expires_at ?? null,
    error: payload.error ?? null,
  };
}

function normalizeResult(payload: DuneApiResponse): DuneNormalizedResult {
  const status = normalizeStatus(payload);
  const metadata = payload.result?.metadata;
  const columnNames = metadata?.column_names ?? [];
  const columnTypes = metadata?.column_types ?? [];

  return {
    ...status,
    nextOffset: payload.next_offset ?? null,
    nextUri: payload.next_uri ?? null,
    columns: columnNames.map((name, index) => ({
      name,
      type: columnTypes[index] ?? null,
    })),
    rows: payload.result?.rows ?? [],
    rowCount: metadata?.row_count ?? payload.result?.rows?.length ?? 0,
    totalRowCount: metadata?.total_row_count ?? null,
    updateType: payload.result?.update_type ?? null,
  };
}

export async function executeQueryById(
  queryId: number,
  options?: {
    performance?: "medium" | "large";
    queryParameters?: Record<string, unknown>;
  }
): Promise<{ executionId: string; state: DuneExecutionState | null }> {
  const payload = await duneRequest<DuneApiResponse>(
    "POST",
    `/query/${queryId}/execute`,
    {
      performance: options?.performance,
      query_parameters: options?.queryParameters,
    },
    undefined
  );

  if (!payload.execution_id) {
    throw new DuneApiError("Dune execute response did not include execution_id.", 502, false);
  }

  return {
    executionId: payload.execution_id,
    state: payload.state ?? null,
  };
}

export async function getExecutionStatus(executionId: string): Promise<DuneNormalizedStatus> {
  const payload = await duneRequest<DuneApiResponse>("GET", `/execution/${executionId}/status`);
  return normalizeStatus(payload);
}

export async function pollExecutionUntilFinished(
  executionId: string,
  options?: {
    intervalMs?: number;
    maxAttempts?: number;
  }
): Promise<DuneNormalizedStatus> {
  const intervalMs = options?.intervalMs ?? 2_500;
  const maxAttempts = options?.maxAttempts ?? 120;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const status = await getExecutionStatus(executionId);
    if (status.isExecutionFinished === true) {
      return status;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new DuneApiError("Timed out while polling Dune execution status.", 504, true);
}

export async function getExecutionResults(
  executionId: string,
  options?: {
    limit?: number;
    offset?: number;
    allowPartialResults?: boolean;
  }
): Promise<DuneNormalizedResult> {
  const payload = await duneRequest<DuneApiResponse>(
    "GET",
    `/execution/${executionId}/results`,
    undefined,
    {
      limit: options?.limit,
      offset: options?.offset,
      allow_partial_results: options?.allowPartialResults,
    }
  );
  return normalizeResult(payload);
}

export async function getLatestQueryResult(
  queryId: number,
  options?: {
    limit?: number;
    offset?: number;
    allowPartialResults?: boolean;
  }
): Promise<DuneNormalizedResult> {
  const payload = await duneRequest<DuneApiResponse>(
    "GET",
    `/query/${queryId}/results`,
    undefined,
    {
      limit: options?.limit,
      offset: options?.offset,
      allow_partial_results: options?.allowPartialResults,
    }
  );
  return normalizeResult(payload);
}

export function asOfFromNormalizedResult(result: DuneNormalizedResult): string {
  return result.executionEndedAt ?? result.submittedAt ?? new Date().toISOString();
}
