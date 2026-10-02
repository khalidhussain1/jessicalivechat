import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { deleteTag } from "@/lib/chat-db";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

// deleting a tag DEFINITION (removing it everywhere) is a more global/destructive action
// than applying/removing it on one conversation, so it requires admin+
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;

  await deleteTag(Number(id));
  await logAudit(check.session, "tag.delete", id);
  return NextResponse.json({ ok: true });
}
