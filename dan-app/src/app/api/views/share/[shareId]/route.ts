import { NextResponse } from "next/server";
import { getSharedView } from "@/lib/savedViews";

export async function GET(_req: Request, context: { params: { shareId: string } }) {
  const shareId = context.params.shareId;
  if (!shareId) {
    return NextResponse.json({ error: { message: "Share id is required" } }, { status: 400 });
  }
  const payload = await getSharedView(shareId);
  if (!payload) {
    return NextResponse.json({ error: { message: "Shared view not found" } }, { status: 404 });
  }
  return NextResponse.json({ view: payload });
}


