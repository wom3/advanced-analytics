import { NextRequest } from "next/server";

let requestCounter = 0;

type ApiRequestOptions = {
  method?: string;
  headers?: HeadersInit;
  forwardedFor?: string;
  requestId?: string;
};

export function createApiRequest(path: string, options?: ApiRequestOptions): NextRequest {
  process.env["TRUST_PROXY_HEADERS"] = "true";

  requestCounter += 1;
  const headers = new Headers(options?.headers);
  headers.set("x-forwarded-for", options?.forwardedFor ?? `198.51.100.${requestCounter}`);

  if (options?.requestId) {
    headers.set("x-request-id", options.requestId);
  }

  return new NextRequest(`http://127.0.0.1:3000${path}`, {
    method: options?.method ?? "GET",
    headers,
  });
}
