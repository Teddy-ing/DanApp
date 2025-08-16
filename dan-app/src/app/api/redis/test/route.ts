import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return NextResponse.json({ error: { message: "Missing Upstash REST envs" } }, { status: 500 });
  }

  const key = `debug:write:${userId}:${Date.now()}`;
  const value = "ok";

  async function req(method: string, path: string) {
    try {
      const res = await fetch(`${url}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await res.text();
      return { ok: res.ok, status: res.status, body: text };
    } catch (e) {
      return { ok: false, status: 0, body: (e as Error)?.message || "" };
    }
  }

  const setRes = await req("POST", `/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`);
  const getRes = await req("GET", `/get/${encodeURIComponent(key)}`);
  const delRes = await req("POST", `/del/${encodeURIComponent(key)}`);

  return NextResponse.json({
    endpoint: url,
    set: setRes,
    get: getRes,
    del: delRes,
  });
}


