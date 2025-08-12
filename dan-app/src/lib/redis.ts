import { Redis } from "@upstash/redis";

// Thin wrapper around Upstash REST Redis with simple JSON helpers and TTL support

export type RedisClient = ReturnType<typeof createRedisClient>;

export function createRedisClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    // In dev, we prefer an explicit error to avoid silent failures
    throw new Error("Missing Upstash Redis env vars: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN");
  }
  const client = new Redis({ url, token });

  return {
    raw: client,
    async getJson<T>(key: string): Promise<T | null> {
      const result = await client.get<string>(key);
      if (result == null) return null;
      try {
        return JSON.parse(result) as T;
      } catch {
        // If parsing fails, treat as cache miss to avoid propagating error
        return null;
      }
    },
    async setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
      const payload = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await client.set(key, payload, { ex: ttlSeconds });
      } else {
        await client.set(key, payload);
      }
    },
  };
}


