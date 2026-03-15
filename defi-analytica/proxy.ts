import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getOrCreateRequestId, REQUEST_ID_HEADER } from "@/src/server/api/envelope";
import { logApiInfo } from "@/src/server/observability/logger";

export function proxy(request: NextRequest) {
  const requestId = getOrCreateRequestId(request.headers);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  logApiInfo({
    event: "api.request.received",
    requestId,
    method: request.method,
    path: request.nextUrl.pathname,
  });

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export const config = {
  matcher: ["/api/v1/:path*"],
};
