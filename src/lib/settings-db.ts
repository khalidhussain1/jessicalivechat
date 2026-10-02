import { sql, ensureSchema } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { AgentSession } from "@/lib/agent-auth";

export type AppearanceSettings = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  borderRadius: number;
  logoUrl: string | null;
  avatarUrl: string | null;
  supportName: string;
  supportSubtitle: string;
  welcomeMessage: string;
};

export type SupportAvailabilitySettings = {
  status: "online" | "offline" | "away";
  offlineMessage: string;
};

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  primaryColor: "#16a34a",
  secondaryColor: "#15803d",
  accentColor: "#16a34a",
  backgroundColor: "#f4f8f6",
  borderRadius: 24,
  logoUrl: null,
  avatarUrl: null,
  supportName: "Jessica",
  supportSubtitle: "Game Support",
  welcomeMessage: "You're chatting with Jessica, your gamer support crew. Send a message to get started.",
};

export const DEFAULT_SUPPORT_AVAILABILITY: SupportAvailabilitySettings = {
  status: "online",
  offlineMessage: "Support is currently offline. You can still leave a message and we'll get back to you.",
};

// only these keys are ever exposed to the unauthenticated customer frontend —
// never widen this without checking what each settings key may contain
export const PUBLIC_SETTINGS_KEYS = ["appearance", "support_availability"] as const;

const DEFAULTS: Record<string, unknown> = {
  appearance: DEFAULT_APPEARANCE,
  support_availability: DEFAULT_SUPPORT_AVAILABILITY,
};

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  await ensureSchema();
  const rows = await sql`SELECT value FROM app_settings WHERE key = ${key}`;
  if (!rows[0]) return fallback;
  return { ...fallback, ...(rows[0].value as object) } as T;
}

export async function setSetting(
  key: string,
  value: Record<string, unknown>,
  actor: AgentSession,
): Promise<void> {
  await ensureSchema();
  const now = Date.now();
  await sql`
    INSERT INTO app_settings (key, value, updated_at, updated_by)
    VALUES (${key}, ${JSON.stringify(value)}, ${now}, ${actor.id})
    ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(value)}, updated_at = ${now}, updated_by = ${actor.id}
  `;
  await logAudit(actor, "settings.update", key, { key });
}

export async function resetSetting(key: string, actor: AgentSession): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM app_settings WHERE key = ${key}`;
  await logAudit(actor, "settings.reset", key, { key });
}

export async function getPublicSettings(): Promise<Record<string, unknown>> {
  await ensureSchema();
  const rows = await sql`
    SELECT key, value FROM app_settings WHERE key = ANY(${PUBLIC_SETTINGS_KEYS as unknown as string[]})
  `;
  const result: Record<string, unknown> = {};
  for (const key of PUBLIC_SETTINGS_KEYS) {
    const row = rows.find((r) => r.key === key);
    result[key] = row ? { ...(DEFAULTS[key] as object), ...(row.value as object) } : DEFAULTS[key];
  }
  return result;
}
