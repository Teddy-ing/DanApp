import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { SavedViewError, deleteSavedView, getSavedView, updateSavedView } from "@/lib/savedViews";
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

export async function GET(req: NextRequest, context: { params: { viewId: string } }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return unauthorized();
  }
  const viewId = context.params.viewId;
  try {
    const view = await getSavedView(userId, viewId);
    return NextResponse.json({ view: serializeView(view) });
  } catch (error) {
    return handleSavedViewError(error);
  }
}

export async function PATCH(req: NextRequest, context: { params: { viewId: string } }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return unauthorized();
  }
  const viewId = context.params.viewId;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON body" } }, { status: 400 });
  }
  const payload = (typeof body === "object" && body != null ? body : {}) as Record<string, unknown>;
  try {
    const view = await updateSavedView(userId, viewId, {
      name: payload.name,
      symbols: payload.symbols,
      base: payload.base,
      horizon: payload.horizon,
      custom: payload.custom,
      viewMode: payload.viewMode,
    });
    return NextResponse.json({ view: serializeView(view) });
  } catch (error) {
    return handleSavedViewError(error);
  }
}

export async function DELETE(_req: NextRequest, context: { params: { viewId: string } }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return unauthorized();
  }
  const viewId = context.params.viewId;
  try {
    await deleteSavedView(userId, viewId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleSavedViewError(error);
  }
}


