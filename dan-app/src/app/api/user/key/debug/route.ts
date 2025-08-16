import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRedisClient } from "@/lib/redis";
import { getDecryptedRapidApiKey } from "@/lib/userKey";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  const hasAuthSecret = Boolean(process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET);
  const hasRedisUrl = Boolean(process.env.UPSTASH_REDIS_REST_URL);
  const hasRedisToken = Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);

  let reachable = false;
  let exists = false;
  let ivLen: number | null = null;
  let ctLen: number | null = null;

  if (hasRedisUrl && hasRedisToken) {
    // Prefer REST so we see the exact data layer
    try {
      const keyName = `user:${userId}:rapidapiKey`;
      const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(keyName)}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
      });
      reachable = true;
      if (res.ok) {
        const text = await res.text();
        const outer = JSON.parse(text);
        if (outer && typeof outer.result === "string") {
          try {
            const inner = JSON.parse(outer.result) as { iv?: string; ciphertext?: string };
            if (inner && typeof inner.iv === "string" && typeof inner.ciphertext === "string") {
              exists = true;
              ivLen = inner.iv.length;
              ctLen = inner.ciphertext.length;
            }
          } catch {
            // not JSON → treat as absent
          }
        }
      }
    } catch {
      // ignore; leave defaults
    }
  } else {
    // Fallback via SDK
    try {
      const redis = createRedisClient();
      const rec = await redis.getJson<{ iv: string; ciphertext: string }>(`user:${userId}:rapidapiKey`);
      reachable = true;
      if (rec) {
        exists = true;
        ivLen = typeof rec.iv === "string" ? rec.iv.length : null;
        ctLen = typeof rec.ciphertext === "string" ? rec.ciphertext.length : null;
      }
    } catch {}
  }

  let decryptOk = false;
  let decryptErrorCode: string | undefined;
  try {
    const key = await getDecryptedRapidApiKey(userId);
    if (key && typeof key === "string" && key.length > 0) decryptOk = true;
  } catch (e) {
    decryptErrorCode = (e as Error)?.message || "UNKNOWN";
  }

  return NextResponse.json({
    user: { id: userId },
    env: { hasAuthSecret, hasRedisUrl, hasRedisToken },
    redis: { reachable, exists },
    record: { ivLen, ctLen },
    decrypt: { ok: decryptOk, errorCode: decryptErrorCode },
  });
}


