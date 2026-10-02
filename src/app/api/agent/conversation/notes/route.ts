import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { addConversationNote, listConversationNotes } from "@/lib/chat-db";

export const runtime = "nodejs";

// internal notes — this route (and its data) must NEVER be reachable from any
// customer-facing API; only the agent-session-gated routes here ever touch it
export async function GET(request: NextRequest) {
  const check = await requireAgentRole(request, "agent");
  if ("response" in check) return check.response;

  const visitorId = request.nextUrl.searchParams.get("visitorId");
  if (!visitorId) {
    return NextResponse.json({ error: "visitorId is required" }, { status: 400 });
  }
  return NextResponse.json({ notes: await listConversationNotes(visitorId) });
}

export async function POST(request: NextRequest) {
  const check = await requireAgentRole(request, "agent");
  if ("response" in check) return check.response;

  const body = await request.json().catch(() => null);
  const visitorId = typeof body?.visitorId === "string" ? body.visitorId : "";
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 2000) : "";
  if (!visitorId || !text) {
    return NextResponse.json({ error: "visitorId and text are required" }, { status: 400 });
  }

  const note = await addConversationNote(visitorId, check.session.id, check.session.name, text);
  return NextResponse.json({ note });
}
