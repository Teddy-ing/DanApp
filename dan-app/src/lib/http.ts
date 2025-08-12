export type FetchOptions = RequestInit & { timeoutMs?: number };

export async function fetchWithTimeout(url: string, options: FetchOptions = {}): Promise<Response> {
  const { timeoutMs = 8000, ...init } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

// Guard to prevent accidental logging of secrets
// If value looks like a token/key (long base64/hex-ish), return masked summary
export function maskSecret(value: string | undefined | null): string {
  if (!value) return "";
  const v = String(value);
  if (v.length >= 12) {
    return `${v.slice(0, 4)}…${v.slice(-4)}`;
  }
  return "***";
}


