import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRedisClient } from "@/lib/redis";

type SaveKeyBody = {
	rapidapiKey: string;
};

function badRequest(message: string) {
	return NextResponse.json({ error: { message } }, { status: 400 });
}

function unauthorized() {
	return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
}

async function deriveAesGcmKey(secret: string, saltBytes: Uint8Array): Promise<CryptoKey> {
	const enc = new TextEncoder();
	const baseKey = await crypto.subtle.importKey(
		"raw",
		enc.encode(secret),
		{ name: "HKDF" },
		false,
		["deriveKey"]
	);
	const salt = new Uint8Array(saltBytes).buffer;
	return crypto.subtle.deriveKey(
		{ name: "HKDF", hash: "SHA-256", salt, info: enc.encode("rapidapiKey") },
		baseKey,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"]
	);
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
	await redis.setJson(`user:${userId}:rapidapiKey`, { iv: ivB64, ciphertext });

	return NextResponse.json({ ok: true });
}

export async function GET() {
	const session = await auth();
	if (!session?.user || !(session.user as { id?: string }).id) {
		return unauthorized();
	}
	const userId = (session.user as { id: string }).id;

	const redis = createRedisClient();
	const record = await redis.getJson<{ iv: string; ciphertext: string }>(`user:${userId}:rapidapiKey`);
	const hasKey = !!(record && typeof record.ciphertext === "string" && record.ciphertext.length > 0);
	return NextResponse.json({ hasKey });
}


