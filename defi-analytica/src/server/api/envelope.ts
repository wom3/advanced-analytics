import { NextResponse } from "next/server";

type Meta = Record<string, unknown>;

export type ApiSuccess<T> = {
  source: string;
  asOf: string;
  freshnessSec: number;
  data: T;
  meta: Meta;
};

export type ApiError = {
  code: string;
  message: string;
  retryable: boolean;
};

type SuccessInput<T> = {
  source: string;
  data: T;
  freshnessSec?: number;
  meta?: Meta;
  status?: number;
  requestId?: string;
};

type ErrorInput = ApiError & {
  status?: number;
  requestId?: string;
};

export const REQUEST_ID_HEADER = "x-request-id";

export function successEnvelope<T>(input: SuccessInput<T>): ApiSuccess<T> {
  return {
    source: input.source,
    asOf: new Date().toISOString(),
    freshnessSec: input.freshnessSec ?? 0,
    data: input.data,
    meta: input.meta ?? {},
  };
}

export function errorEnvelope(input: ApiError): ApiError {
  return {
    code: input.code,
    message: input.message,
    retryable: input.retryable,
  };
}

export function jsonSuccess<T>(input: SuccessInput<T>): NextResponse<ApiSuccess<T>> {
  const response = NextResponse.json(successEnvelope(input), {
    status: input.status ?? 200,
  });

  if (input.requestId) {
    response.headers.set(REQUEST_ID_HEADER, input.requestId);
  }

  return response;
}

export function jsonError(input: ErrorInput): NextResponse<ApiError> {
  const response = NextResponse.json(errorEnvelope(input), {
    status: input.status ?? 500,
  });

  if (input.requestId) {
    response.headers.set(REQUEST_ID_HEADER, input.requestId);
  }

  return response;
}

export function getOrCreateRequestId(headers: Headers): string {
  const existing = headers.get(REQUEST_ID_HEADER);
  return existing && existing.trim().length > 0 ? existing : crypto.randomUUID();
}
