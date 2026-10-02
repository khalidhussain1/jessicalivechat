import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { listConversations } from "@/lib/chat-db";
import { listAnnouncements, listFaqs } from "@/lib/content-db";
import { sql, ensureSchema } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

const MESSAGE_EXPORT_LIMIT = 5000;

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const str = value == null ? "" : String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [headers.join(","), ...rows.map((row) => headers.map((h) => escape(row[h])).join(","))];
  return lines.join("\n");
}

async function getData(entity: string): Promise<Record<string, unknown>[] | null> {
  await ensureSchema();
  switch (entity) {
    case "conversations":
      return (await listConversations()).map((c) => ({
        visitorId: c.visitorId,
        ticketNo: c.ticketNo,
        visitorName: c.visitorName,
        status: c.status,
        priority: c.priority,
        createdAt: c.createdAt,
        lastMessageAt: c.lastMessageAt,
      }));
    case "messages": {
      const rows = await sql`
        SELECT visitor_id as "visitorId", sender, sender_name as "senderName", text, created_at as "createdAt"
        FROM messages ORDER BY id DESC LIMIT ${MESSAGE_EXPORT_LIMIT}
      `;
      return rows as Record<string, unknown>[];
    }
    case "customers": {
      // never includes password_hash or any other credential/secret
      const rows = await sql`SELECT id, email, name, phone, provider, created_at as "createdAt" FROM users`;
      return rows as Record<string, unknown>[];
    }
    case "announcements":
      return (await listAnnouncements()) as unknown as Record<string, unknown>[];
    case "faqs":
      return (await listFaqs()) as unknown as Record<string, unknown>[];
    default:
      return null;
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  const check = await requireAgentRole(request, "super_admin");
  if ("response" in check) return check.response;

  const data = await getData(entity);
  if (!data) {
    return NextResponse.json({ error: "Unknown export entity" }, { status: 404 });
  }

  await logAudit(check.session, "export", entity);

  const format = request.nextUrl.searchParams.get("format") === "csv" ? "csv" : "json";
  if (format === "csv") {
    return new NextResponse(toCsv(data), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${entity}.csv"`,
      },
    });
  }
  return NextResponse.json(data);
}
