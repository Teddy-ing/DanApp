import { handlers } from "@/auth";

// TEMP DEBUG WRAPPERS — remove after verification
export async function GET(request: Request, context: unknown) {
  try {
    console.log(
      "[auth][debug] GET /api/auth — incoming request",
      JSON.stringify(
        {
          url: request.url,
          host: request.headers.get("host"),
          xForwardedHost: request.headers.get("x-forwarded-host"),
          xForwardedProto: request.headers.get("x-forwarded-proto"),
          forwarded: request.headers.get("forwarded"),
        },
        null,
        0
      )
    );
  } catch {}
  // @ts-expect-error - context passthrough is fine for NextAuth handlers
  return handlers.GET(request, context);
}

export async function POST(request: Request, context: unknown) {
  try {
    console.log(
      "[auth][debug] POST /api/auth — incoming request",
      JSON.stringify(
        {
          url: request.url,
          host: request.headers.get("host"),
          xForwardedHost: request.headers.get("x-forwarded-host"),
          xForwardedProto: request.headers.get("x-forwarded-proto"),
          forwarded: request.headers.get("forwarded"),
        },
        null,
        0
      )
    );
  } catch {}
  // @ts-expect-error - context passthrough is fine for NextAuth handlers
  return handlers.POST(request, context);
}


