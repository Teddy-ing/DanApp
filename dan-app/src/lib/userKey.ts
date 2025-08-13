import { createRedisClient } from "@/lib/redis";

async function deriveAesGcmKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HKDF" }, false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: enc.encode("rapidapiKey") },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function getDecryptedRapidApiKey(userId: string): Promise<string | null> {
  const redis = createRedisClient();
  const record = await redis.getJson<{ iv: string; ciphertext: string }>(`user:${userId}:rapidapiKey`);
  if (!record) return null;
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  try {
    const iv = Uint8Array.from(Buffer.from(record.iv, "base64"));
    const ciphertext = Uint8Array.from(Buffer.from(record.ciphertext, "base64"));
    const key = await deriveAesGcmKey(secret, new TextEncoder().encode(userId));
    const plaintextBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return new TextDecoder().decode(plaintextBuf);
  } catch {
    return null;
  }
}


