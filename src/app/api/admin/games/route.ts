import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { listGames } from "@/lib/games-db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;
  return NextResponse.json({ games: await listGames() });
}
