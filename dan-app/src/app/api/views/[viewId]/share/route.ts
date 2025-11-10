import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { SavedViewError, disableSavedViewShare, enableSavedViewShare, getSavedView } from "@/lib/savedViews";

function unauthorized() {
  return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
}

function handleSavedViewError(error: unknown) {
  if (error instanceof SavedViewError) {
    return NextResponse.json({ error: { message: error.message } }, { status: error.status });
  }
  throw error;
}

export async function POST(req: NextRequest, context: { params: { viewId: string } }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return unauthorized();
  }
  const viewId = context.params.viewId;
  try {
    const { shareId } = await enableSavedViewShare(userId, viewId);
    const view = await getSavedView(userId, viewId);
    const origin = req.nextUrl?.origin ?? "";
    const shareUrl = `${origin.replace(/\/$/, "")}/returns?share=${shareId}`;
    return NextResponse.json({ shareId, shareUrl, view: { ...view, shareId: view.shareId ?? shareId } });
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
    await disableSavedViewShare(userId, viewId);
    const view = await getSavedView(userId, viewId);
    return NextResponse.json({ ok: true, view: { ...view, shareId: view.shareId ?? null } });
  } catch (error) {
    return handleSavedViewError(error);
  }
}


