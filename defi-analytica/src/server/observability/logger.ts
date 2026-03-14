type LogLevel = "info" | "warn" | "error";

type ApiLogEvent = {
  event: string;
  requestId: string;
  method?: string;
  path?: string;
  status?: number;
  durationMs?: number;
  message?: string;
  meta?: Record<string, unknown>;
};

function emit(level: LogLevel, payload: ApiLogEvent): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    ...payload,
  });

  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.info(line);
}

export function logApiInfo(event: ApiLogEvent): void {
  emit("info", event);
}

export function logApiWarn(event: ApiLogEvent): void {
  emit("warn", event);
}

export function logApiError(event: ApiLogEvent): void {
  emit("error", event);
}
