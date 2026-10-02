import { NextRequest, NextResponse } from "next/server";
import { getProfileStats } from "@/lib/profile-db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const visitorId = request.nextUrl.searchParams.get("visitorId");
  if (!visitorId) {
    return NextResponse.json({ error: "visitorId is required" }, { status: 400 });
  }
  return NextResponse.json(await getProfileStats(visitorId));
}
