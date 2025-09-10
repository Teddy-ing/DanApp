import { createRedisClient } from "@/lib/redis";

export async function deriveAesGcmKey(secret: string, saltBytes: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HKDF" }, false, ["deriveKey"]);
  const salt = new Uint8Array(saltBytes).buffer;
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: enc.encode("rapidapiKey") },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function getRecordViaRest(userId: string): Promise<{ iv: string; ciphertext: string } | null> {
  const restUrl = process.env.UPSTASH_REDIS_REST_URL;
  const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!restUrl || !restToken) return null;
  try {
    const keyName = `user:${userId}:rapidapiKey`;
    const res = await fetch(`${restUrl}/get/${encodeURIComponent(keyName)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${restToken}` },
    });
    if (!res.ok) return null;
    const text = await res.text();
    // Upstash returns {"result":"<string or null>"}
    const outer = JSON.parse(text);
    if (!outer || typeof outer.result !== "string") return null;
    const inner = JSON.parse(outer.result) as { iv?: string; ciphertext?: string };
    if (typeof inner?.iv === "string" && typeof inner?.ciphertext === "string") {
      return { iv: inner.iv, ciphertext: inner.ciphertext };
    }
    return null;
  } catch {
    return null;
  }
}

export async function getDecryptedRapidApiKey(userId: string): Promise<string | null> {
  // Prefer REST path first
  const restRecord = await getRecordViaRest(userId);
  let record = restRecord;
  if (!record) {
    const redis = createRedisClient();
    record = await redis.getJson<{ iv: string; ciphertext: string }>(`user:${userId}:rapidapiKey`);
  }
  if (!record) return null;
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('MISCONFIG_SECRET');
  try {
    const iv = Uint8Array.from(Buffer.from(record.iv, "base64"));
    const ciphertext = Uint8Array.from(Buffer.from(record.ciphertext, "base64"));
    const key = await deriveAesGcmKey(secret, new TextEncoder().encode(userId));
    const plaintextBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return new TextDecoder().decode(plaintextBuf);
  } catch {
    throw new Error('DECRYPT_FAILED');
  }
}


