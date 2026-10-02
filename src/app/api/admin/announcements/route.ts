import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { listAnnouncements, createAnnouncement, type AnnouncementType } from "@/lib/content-db";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

const VALID_TYPES: AnnouncementType[] = ["info", "success", "warning", "important"];

export async function GET(request: NextRequest) {
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;
  return NextResponse.json({ announcements: await listAnnouncements() });
}

export async function POST(request: NextRequest) {
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.replace(/<[^>]*>/g, "").slice(0, 500) : "";
  const type = VALID_TYPES.includes(body?.type) ? (body.type as AnnouncementType) : "info";
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const announcement = await createAnnouncement({
    text,
    type,
    dismissible: body?.dismissible !== false,
    linkLabel: typeof body?.linkLabel === "string" ? body.linkLabel.slice(0, 60) : null,
    linkUrl: typeof body?.linkUrl === "string" ? body.linkUrl.slice(0, 500) : null,
    startsAt: typeof body?.startsAt === "number" ? body.startsAt : null,
    endsAt: typeof body?.endsAt === "number" ? body.endsAt : null,
  });
  await logAudit(check.session, "announcement.create", String(announcement.id));
  return NextResponse.json({ announcement });
}
