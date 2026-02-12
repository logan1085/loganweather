import { NextRequest, NextResponse } from "next/server";
import { removeSubscriberByToken } from "@/lib/subscribers";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  try {
    const removed = await removeSubscriberByToken(token);
    if (!removed) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to unsubscribe" }, { status: 500 });
  }
}
