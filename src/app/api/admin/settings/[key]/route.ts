import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import { getSetting, setSetting, resetSetting, DEFAULT_APPEARANCE, DEFAULT_SUPPORT_AVAILABILITY } from "@/lib/settings-db";

export const runtime = "nodejs";

const ALLOWED_KEYS = new Set(["appearance", "support_availability"]);

function defaultFor(key: string) {
  if (key === "appearance") return DEFAULT_APPEARANCE;
  if (key === "support_availability") return DEFAULT_SUPPORT_AVAILABILITY;
  return null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!ALLOWED_KEYS.has(key)) {
    return NextResponse.json({ error: "Unknown settings key" }, { status: 404 });
  }
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;

  const value = await getSetting(key, defaultFor(key));
  return NextResponse.json({ key, value });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!ALLOWED_KEYS.has(key)) {
    return NextResponse.json({ error: "Unknown settings key" }, { status: 404 });
  }
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid settings payload" }, { status: 400 });
  }

  // never persist HTML/script-bearing text — every customer-facing settings field is
  // rendered as plain text client-side, but strip tags here too as defense in depth
  const sanitized: Record<string, unknown> = {};
  for (const [field, raw] of Object.entries(body)) {
    sanitized[field] = typeof raw === "string" ? raw.replace(/<[^>]*>/g, "").slice(0, 2000) : raw;
  }

  await setSetting(key, sanitized, check.session);
  const value = await getSetting(key, defaultFor(key));
  return NextResponse.json({ key, value });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!ALLOWED_KEYS.has(key)) {
    return NextResponse.json({ error: "Unknown settings key" }, { status: 404 });
  }
  const check = await requireAgentRole(request, "admin");
  if ("response" in check) return check.response;

  await resetSetting(key, check.session);
  return NextResponse.json({ key, value: defaultFor(key) });
}
