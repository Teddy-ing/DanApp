import { createRedisClient } from "./redis";
import { isIP } from "node:net";

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

const redis = createRedisClient().raw;

export async function checkRateLimit(
  routeKey: string,
  userKey: string,
  limit: number = 30,
  windowSeconds: number = 60
): Promise<RateLimitResult> {
  const key = `rl:${routeKey}:${userKey}:${windowSeconds}`;
  const nowMs = Date.now();
  const windowMs = windowSeconds * 1000;
  const earliestMs = nowMs - windowMs;

  // Remove entries outside the window
  await redis.zremrangebyscore(key, 0, earliestMs);

  const count = await redis.zcard(key);
  if (typeof count === "number" && count >= limit) {
    // Oldest timestamp to expire determines wait timea
    const oldestMembers = (await redis.zrange(key, 0, 0)) as string[];
    let oldestMs = nowMs;
    if (oldestMembers && oldestMembers.length > 0) {
      const token = oldestMembers[0];
      const tsPart = Number(token.split("-")[0]);
      if (Number.isFinite(tsPart)) oldestMs = tsPart;
    }
    const retryAfterSeconds = Math.max(1, Math.ceil((oldestMs + windowMs - nowMs) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  // Add current request
  const member = `${nowMs}-${Math.random().toString(36).slice(2, 10)}`;
  await redis.zadd(key, { score: nowMs, member });
  await redis.expire(key, windowSeconds);
  return { allowed: true };
}

export function extractUserId(headers: Headers): string {
  const explicit = headers.get("x-user-id");
  if (explicit && explicit.trim().length > 0) return explicit.trim();
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const ip = xff.split(",")[0].trim();
    if (isIP(ip)) return ip;
  }
  return "anon";
}


