import type { NextRequest } from "next/server";

type BucketConfig = {
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSec: number;
};

type Hit = {
  count: number;
  resetAt: number;
};

const store = new Map<string, Hit>();

const PUBLIC_BUCKET: BucketConfig = {
  limit: 60,
  windowMs: 60_000,
};

function nowMs(): number {
  return Date.now();
}

function cleanupExpired(now: number): void {
  for (const [key, hit] of store.entries()) {
    if (hit.resetAt <= now) {
      store.delete(key);
    }
  }
}

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function publicRateLimitKey(request: NextRequest): string {
  return `${clientIp(request)}:${request.nextUrl.pathname}`;
}

export function takeToken(key: string, config: BucketConfig = PUBLIC_BUCKET): RateLimitResult {
  const now = nowMs();
  cleanupExpired(now);

  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    const resetAt = now + config.windowMs;
    store.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: Math.max(config.limit - 1, 0),
      resetAt,
      retryAfterSec: Math.ceil(config.windowMs / 1000),
    };
  }

  if (current.count >= config.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt,
      retryAfterSec: Math.max(Math.ceil((current.resetAt - now) / 1000), 1),
    };
  }

  current.count += 1;
  store.set(key, current);

  return {
    allowed: true,
    remaining: Math.max(config.limit - current.count, 0),
    resetAt: current.resetAt,
    retryAfterSec: Math.max(Math.ceil((current.resetAt - now) / 1000), 1),
  };
}
