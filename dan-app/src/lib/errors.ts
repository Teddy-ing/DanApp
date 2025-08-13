import { ProviderError } from "@/providers/yahoo";
import { TickerValidationError } from "@/lib/ticker";

export type ApiErrorPayload = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

type ToApiError = {
  status: number;
  payload: ApiErrorPayload;
};

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function toApiError(err: unknown): ToApiError {
  const prod = isProduction();

  // Ticker validation → 400
  if (err instanceof TickerValidationError) {
    return {
      status: 400,
      payload: {
        error: {
          code: "INVALID_TICKER",
          message: err.message,
          details: prod ? undefined : { name: err.name },
        },
      },
    };
  }

  // Upstream provider errors → passthrough status, generic message in prod
  if (err instanceof ProviderError) {
    const code = err.providerArea === "candles" ? "PROVIDER_CANDLES_ERROR" : "PROVIDER_EVENTS_ERROR";
    return {
      status: Math.min(Math.max(err.status || 502, 400), 599),
      payload: {
        error: {
          code,
          message: prod ? "Upstream provider error" : err.message,
          details: prod ? undefined : { bodySnippet: err.bodySnippet },
        },
      },
    };
  }

  // Unknown/internal
  const anyErr = err as any;
  const message = typeof anyErr?.message === "string" ? anyErr.message : "Internal server error";
  const stack = typeof anyErr?.stack === "string" ? anyErr.stack : undefined;
  return {
    status: 500,
    payload: {
      error: {
        code: "INTERNAL_ERROR",
        message: prod ? "Internal server error" : message,
        details: prod ? undefined : { stack },
      },
    },
  };
}


