import { NextRequest, NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/rbac";
import type { AgentRole } from "@/lib/agents-db";
import {
  getSetting,
  setSetting,
  resetSetting,
  DEFAULT_APPEARANCE,
  DEFAULT_SUPPORT_AVAILABILITY,
  DEFAULT_MAINTENANCE,
} from "@/lib/settings-db";

export const runtime = "nodejs";

const KEY_MIN_ROLE: Record<string, AgentRole> = {
  appearance: "admin",
  support_availability: "admin",
  maintenance: "super_admin",
};

function defaultFor(key: string) {
  if (key === "appearance") return DEFAULT_APPEARANCE;
  if (key === "support_availability") return DEFAULT_SUPPORT_AVAILABILITY;
  if (key === "maintenance") return DEFAULT_MAINTENANCE;
  return null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const minRole = KEY_MIN_ROLE[key];
  if (!minRole) {
    return NextResponse.json({ error: "Unknown settings key" }, { status: 404 });
  }
  const check = await requireAgentRole(request, minRole);
  if ("response" in check) return check.response;

  const value = await getSetting(key, defaultFor(key));
  return NextResponse.json({ key, value });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const minRole = KEY_MIN_ROLE[key];
  if (!minRole) {
    return NextResponse.json({ error: "Unknown settings key" }, { status: 404 });
  }
  const check = await requireAgentRole(request, minRole);
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
  const minRole = KEY_MIN_ROLE[key];
  if (!minRole) {
    return NextResponse.json({ error: "Unknown settings key" }, { status: 404 });
  }
  const check = await requireAgentRole(request, minRole);
  if ("response" in check) return check.response;

  await resetSetting(key, check.session);
  return NextResponse.json({ key, value: defaultFor(key) });
}
