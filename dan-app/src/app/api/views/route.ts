import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createSavedView, listSavedViews, SavedViewError } from "@/lib/savedViews";
import type { SavedViewSummary } from "@/types/savedView";

function unauthorized() {
  return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
}

function handleSavedViewError(error: unknown) {
  if (error instanceof SavedViewError) {
    return NextResponse.json({ error: { message: error.message } }, { status: error.status });
  }
  throw error;
}

function serializeView(view: SavedViewSummary) {
  return {
    ...view,
    shareId: view.shareId ?? null,
  };
}

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return unauthorized();
  }
  const items = await listSavedViews(userId);
  return NextResponse.json({ items: items.map(serializeView) });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return unauthorized();
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON body" } }, { status: 400 });
  }
  const payload = (typeof body === "object" && body != null ? body : {}) as Record<string, unknown>;
  try {
    const view = await createSavedView(userId, {
      name: payload.name,
      symbols: payload.symbols,
      base: payload.base,
      horizon: payload.horizon,
      custom: payload.custom,
      viewMode: payload.viewMode,
    });
    return NextResponse.json({ view: serializeView(view) }, { status: 201 });
  } catch (error) {
    return handleSavedViewError(error);
  }
}


