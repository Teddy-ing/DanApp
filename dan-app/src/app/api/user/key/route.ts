import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRedisClient } from "@/lib/redis";
import { deriveAesGcmKey } from "@/lib/userKey";

type SaveKeyBody = {
	rapidapiKey: string;
};

function badRequest(message: string) {
	return NextResponse.json({ error: { message } }, { status: 400 });
}

function unauthorized() {
	return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
}


export async function POST(req: NextRequest) {
	const session = await auth();
	if (!session?.user || !(session.user as { id?: string }).id) {
		return unauthorized();
	}
	const userId = (session.user as { id: string }).id;

	let body: SaveKeyBody;
	try {
		body = (await req.json()) as SaveKeyBody;
	} catch {
		return badRequest("Invalid JSON body");
	}
	const rapidapiKey = (body?.rapidapiKey || "").trim();
	if (rapidapiKey.length < 20) {
		return badRequest("rapidapiKey must be provided");
	}

	const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
	if (!secret) {
		return NextResponse.json({ error: { message: "Server misconfiguration: missing AUTH_SECRET/NEXTAUTH_SECRET" } }, { status: 500 });
	}

	const salt = new TextEncoder().encode(userId);
	const key = await deriveAesGcmKey(secret, salt);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ciphertextBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(rapidapiKey));
	const ciphertext = Buffer.from(ciphertextBuf).toString("base64");
	const ivB64 = Buffer.from(iv).toString("base64");

	const redis = createRedisClient();
	// Prefer direct REST writes for determinism in prod
	const restUrl = process.env.UPSTASH_REDIS_REST_URL;
	const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;
	let persisted = false;
	if (restUrl && restToken) {
		const keyName = `user:${userId}:rapidapiKey`;
		const payload = JSON.stringify({ iv: ivB64, ciphertext });
		try {
			const setRes = await fetch(`${restUrl}/set/${encodeURIComponent(keyName)}/${encodeURIComponent(payload)}`, {
				method: "POST",
				headers: { Authorization: `Bearer ${restToken}` },
			});
			if (setRes.ok) {
				const getRes = await fetch(`${restUrl}/get/${encodeURIComponent(keyName)}`, {
					method: "GET",
					headers: { Authorization: `Bearer ${restToken}` },
				});
				if (getRes.ok) {
					const txt = await getRes.text();
					try {
						const outer = JSON.parse(txt);
						if (outer && typeof outer.result === "string") {
							const inner = JSON.parse(outer.result);
							persisted = Boolean(inner && typeof inner.ciphertext === "string" && inner.ciphertext.length > 0);
						}
					} catch {
						persisted = false;
					}
				}
			}
		} catch {
			persisted = false;
		}
	} else {
		await redis.setJson(`user:${userId}:rapidapiKey`, { iv: ivB64, ciphertext });
		try {
			const verify = await redis.getJson<{ iv: string; ciphertext: string }>(`user:${userId}:rapidapiKey`);
			persisted = !!(verify && typeof verify.ciphertext === "string" && verify.ciphertext.length > 0);
		} catch {
			persisted = false;
		}
	}

	return NextResponse.json({ ok: true, persisted });
}

export async function GET() {
	const session = await auth();
	if (!session?.user || !(session.user as { id?: string }).id) {
		return unauthorized();
	}
	const userId = (session.user as { id: string }).id;

	const restUrl = process.env.UPSTASH_REDIS_REST_URL;
	const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;
	if (restUrl && restToken) {
		try {
			const keyName = `user:${userId}:rapidapiKey`;
			const res = await fetch(`${restUrl}/get/${encodeURIComponent(keyName)}`, {
				method: "GET",
				headers: { Authorization: `Bearer ${restToken}` },
			});
			if (!res.ok) return NextResponse.json({ hasKey: false });
			const txt = await res.text();
			let hasKey = false;
			try {
				const outer = JSON.parse(txt);
				if (outer && typeof outer.result === "string") {
					const inner = JSON.parse(outer.result);
					hasKey = Boolean(inner && typeof inner.ciphertext === "string" && inner.ciphertext.length > 0);
				}
			} catch {
				hasKey = false;
			}
			return NextResponse.json({ hasKey });
		} catch {
			return NextResponse.json({ hasKey: false });
		}
	}

	const redis = createRedisClient();
	const record = await redis.getJson<{ iv: string; ciphertext: string }>(`user:${userId}:rapidapiKey`);
	const hasKey = !!(record && typeof record.ciphertext === "string" && record.ciphertext.length > 0);
	return NextResponse.json({ hasKey });
}


