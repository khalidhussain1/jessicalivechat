import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { listDraws, createDraw } from "@/lib/draws-db";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;
  return NextResponse.json({ draws: await listDraws() });
}

export async function POST(request: NextRequest) {
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.replace(/<[^>]*>/g, "").slice(0, 80) : "";
  const rewardLabel = typeof body?.rewardLabel === "string" ? body.rewardLabel.slice(0, 60) : "";
  if (!title || !rewardLabel) {
    return NextResponse.json({ error: "title and rewardLabel are required" }, { status: 400 });
  }

  const draw = await createDraw({
    title,
    description: typeof body?.description === "string" ? body.description.replace(/<[^>]*>/g, "").slice(0, 300) : "",
    rewardLabel,
    maxEntries: typeof body?.maxEntries === "number" ? body.maxEntries : null,
    startsAt: typeof body?.startsAt === "number" ? body.startsAt : null,
    endsAt: typeof body?.endsAt === "number" ? body.endsAt : null,
  });
  await logAudit(check.session, "lucky_draw.create", String(draw.id));
  return NextResponse.json({ draw });
}
