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
  let line: string;

  try {
    line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      ...payload,
    });
  } catch {
    const fallback = {
      ts: new Date().toISOString(),
      level,
      event: payload.event,
      requestId: payload.requestId,
      message: payload.message,
      serializationError: true,
    };

    try {
      line = JSON.stringify(fallback);
    } catch {
      line = `[${fallback.ts}] level=${level} event=${payload.event} requestId=${payload.requestId}`;
    }
  }

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
