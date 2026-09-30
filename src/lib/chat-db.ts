import { sql, ensureSchema } from "@/lib/db";

const RING_COOLDOWN_MS = 30_000;
export const VISITOR_ONLINE_WINDOW_MS = 15_000;

export type ConversationStatus = "open" | "pending" | "resolved";

export type ChatMessage = {
  id: number;
  visitorId: string;
  sender: "user" | "agent";
  senderName: string | null;
  text: string;
  imageUrl: string | null;
  createdAt: number;
  deliveredAt: number | null;
  readAt: number | null;
};

function toMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: Number(row.id),
    visitorId: row.visitorId as string,
    sender: row.sender as "user" | "agent",
    senderName: row.senderName as string | null,
    text: row.text as string,
    imageUrl: row.imageUrl as string | null,
    createdAt: Number(row.createdAt),
    deliveredAt: row.deliveredAt != null ? Number(row.deliveredAt) : null,
    readAt: row.readAt != null ? Number(row.readAt) : null,
  };
}

async function ensureConversation(visitorId: string) {
  const now = Date.now();
  await sql`
    INSERT INTO conversations (visitor_id, created_at, last_message_at, agent_read_at)
    VALUES (${visitorId}, ${now}, ${now}, 0)
    ON CONFLICT (visitor_id) DO NOTHING
  `;
}

export async function addMessage(
  visitorId: string,
  sender: "user" | "agent",
  text: string,
  options?: { senderName?: string; imageUrl?: string },
): Promise<ChatMessage> {
  await ensureSchema();
  await ensureConversation(visitorId);
  const now = Date.now();
  const senderName = options?.senderName ?? null;
  const imageUrl = options?.imageUrl ?? null;

  const rows = await sql`
    INSERT INTO messages (visitor_id, sender, sender_name, text, image_url, created_at)
    VALUES (${visitorId}, ${sender}, ${senderName}, ${text}, ${imageUrl}, ${now})
    RETURNING id
  `;

  await sql`UPDATE conversations SET last_message_at = ${now} WHERE visitor_id = ${visitorId}`;

  return {
    id: Number(rows[0].id),
    visitorId,
    sender,
    senderName,
    text,
    imageUrl,
    createdAt: now,
    deliveredAt: null,
    readAt: null,
  };
}

export async function getMessages(visitorId: string, afterId = 0): Promise<ChatMessage[]> {
  await ensureSchema();
  const rows = await sql`
    SELECT id, visitor_id as "visitorId", sender, sender_name as "senderName", text,
           image_url as "imageUrl", created_at as "createdAt",
           delivered_at as "deliveredAt", read_at as "readAt"
    FROM messages WHERE visitor_id = ${visitorId} AND id > ${afterId} ORDER BY id ASC
  `;
  return rows.map(toMessage);
}

// own messages whose delivered/read status the sender hasn't necessarily seen yet —
// polled separately (outside the afterId cursor) so a sender can watch their own ticks
// progress sent -> delivered -> read without re-fetching the whole history. Keeps
// returning a message for a short grace period after it's read, so the client's poll
// catches that final transition instead of the row just disappearing from this query.
const PENDING_READ_GRACE_MS = 15_000;

export async function getPendingSentMessages(
  visitorId: string,
  senderRole: "user" | "agent",
): Promise<ChatMessage[]> {
  await ensureSchema();
  const rows = await sql`
    SELECT id, visitor_id as "visitorId", sender, sender_name as "senderName", text,
           image_url as "imageUrl", created_at as "createdAt",
           delivered_at as "deliveredAt", read_at as "readAt"
    FROM messages
    WHERE visitor_id = ${visitorId} AND sender = ${senderRole}
      AND (read_at IS NULL OR read_at > ${Date.now() - PENDING_READ_GRACE_MS})
    ORDER BY id ASC
  `;
  return rows.map(toMessage);
}

// mark the OTHER party's messages as delivered to/seen by `viewerRole`
export async function markDelivered(visitorId: string, viewerRole: "user" | "agent") {
  await ensureSchema();
  const senderRole = viewerRole === "user" ? "agent" : "user";
  await sql`
    UPDATE messages SET delivered_at = ${Date.now()}
    WHERE visitor_id = ${visitorId} AND sender = ${senderRole} AND delivered_at IS NULL
  `;
}

export async function markRead(visitorId: string, viewerRole: "user" | "agent") {
  await ensureSchema();
  const senderRole = viewerRole === "user" ? "agent" : "user";
  const now = Date.now();
  await sql`
    UPDATE messages SET read_at = ${now}, delivered_at = COALESCE(delivered_at, ${now})
    WHERE visitor_id = ${visitorId} AND sender = ${senderRole} AND read_at IS NULL
  `;
}

// mark every customer message across all conversations as delivered — called when the
// agent dashboard's conversation list loads, since that's when the agent's system
// becomes aware of them (separate from "read", which requires opening the conversation)
export async function markAllUserMessagesDelivered() {
  await ensureSchema();
  await sql`UPDATE messages SET delivered_at = ${Date.now()} WHERE sender = 'user' AND delivered_at IS NULL`;
}

export async function setTyping(visitorId: string, from: "user" | "agent") {
  await ensureSchema();
  await ensureConversation(visitorId);
  const now = Date.now();
  if (from === "user") {
    await sql`UPDATE conversations SET visitor_typing_at = ${now} WHERE visitor_id = ${visitorId}`;
  } else {
    await sql`UPDATE conversations SET agent_typing_at = ${now} WHERE visitor_id = ${visitorId}`;
  }
}

export async function getTypingStatus(visitorId: string) {
  await ensureSchema();
  const rows = await sql`
    SELECT visitor_typing_at as "visitorTypingAt", agent_typing_at as "agentTypingAt",
           rung_at as "rungAt", ring_dismissed_at as "ringDismissedAt"
    FROM conversations WHERE visitor_id = ${visitorId}
  `;
  const row = rows[0];
  const rungAt = row ? Number(row.rungAt) : 0;
  const ringDismissedAt = row ? Number(row.ringDismissedAt) : 0;
  return {
    visitorTypingAt: row ? Number(row.visitorTypingAt) : 0,
    agentTypingAt: row ? Number(row.agentTypingAt) : 0,
    rungAt,
    ringActive: rungAt > 0 && rungAt > ringDismissedAt,
  };
}

// customer "ring the bell" — rate-limited request for an agent to respond ASAP.
// Stays "active" (continues alerting the agent) until the agent explicitly dismisses it,
// independent of this cooldown, which only throttles how often a NEW ring can be sent.
export async function ringForHelp(
  visitorId: string,
): Promise<{ ok: true; rungAt: number } | { ok: false; retryAfterMs: number }> {
  await ensureSchema();
  await ensureConversation(visitorId);
  const rows = await sql`SELECT rung_at as "rungAt" FROM conversations WHERE visitor_id = ${visitorId}`;
  const lastRung = Number(rows[0]?.rungAt ?? 0);
  const now = Date.now();
  const elapsed = now - lastRung;

  if (lastRung > 0 && elapsed < RING_COOLDOWN_MS) {
    return { ok: false, retryAfterMs: RING_COOLDOWN_MS - elapsed };
  }

  await sql`UPDATE conversations SET rung_at = ${now} WHERE visitor_id = ${visitorId}`;
  return { ok: true, rungAt: now };
}

// agent dismisses one ringing conversation, or all of them at once (visitorId omitted)
export async function dismissRing(visitorId?: string) {
  await ensureSchema();
  const now = Date.now();
  if (visitorId) {
    await sql`UPDATE conversations SET ring_dismissed_at = ${now} WHERE visitor_id = ${visitorId}`;
  } else {
    await sql`UPDATE conversations SET ring_dismissed_at = ${now} WHERE rung_at > ring_dismissed_at`;
  }
}

export async function touchVisitorSeen(visitorId: string) {
  await ensureSchema();
  await ensureConversation(visitorId);
  await sql`UPDATE conversations SET visitor_last_seen_at = ${Date.now()} WHERE visitor_id = ${visitorId}`;
}

export async function setConversationStatus(visitorId: string, status: ConversationStatus) {
  await ensureSchema();
  await sql`UPDATE conversations SET status = ${status} WHERE visitor_id = ${visitorId}`;
}

export type ConversationSummary = {
  visitorId: string;
  visitorName: string | null;
  createdAt: number;
  lastMessageAt: number;
  agentReadAt: number;
  visitorTypingAt: number;
  rungAt: number;
  ringActive: boolean;
  visitorOnline: boolean;
  status: ConversationStatus;
  lastMessageText: string | null;
  lastMessageSender: "user" | "agent" | null;
  lastMessageImage: boolean;
  unread: boolean;
};

export async function listConversations(): Promise<ConversationSummary[]> {
  await ensureSchema();
  const rows = await sql`
    SELECT
      c.visitor_id as "visitorId",
      c.created_at as "createdAt",
      c.last_message_at as "lastMessageAt",
      c.agent_read_at as "agentReadAt",
      c.visitor_typing_at as "visitorTypingAt",
      c.rung_at as "rungAt",
      c.ring_dismissed_at as "ringDismissedAt",
      c.visitor_last_seen_at as "visitorLastSeenAt",
      c.status as "status",
      (SELECT m.sender_name FROM messages m
        WHERE m.visitor_id = c.visitor_id AND m.sender = 'user' AND m.sender_name IS NOT NULL
        ORDER BY m.id DESC LIMIT 1) as "visitorName",
      (SELECT m.text FROM messages m WHERE m.visitor_id = c.visitor_id ORDER BY m.id DESC LIMIT 1) as "lastMessageText",
      (SELECT m.sender FROM messages m WHERE m.visitor_id = c.visitor_id ORDER BY m.id DESC LIMIT 1) as "lastMessageSender",
      (SELECT m.image_url FROM messages m WHERE m.visitor_id = c.visitor_id ORDER BY m.id DESC LIMIT 1) as "lastMessageImage"
    FROM conversations c
    ORDER BY c.last_message_at DESC
  `;

  const now = Date.now();
  return rows.map((row) => {
    const rungAt = Number(row.rungAt);
    const ringDismissedAt = Number(row.ringDismissedAt);
    return {
      visitorId: row.visitorId,
      visitorName: row.visitorName,
      createdAt: Number(row.createdAt),
      lastMessageAt: Number(row.lastMessageAt),
      agentReadAt: Number(row.agentReadAt),
      visitorTypingAt: Number(row.visitorTypingAt),
      rungAt,
      ringActive: rungAt > 0 && rungAt > ringDismissedAt,
      visitorOnline: now - Number(row.visitorLastSeenAt) < VISITOR_ONLINE_WINDOW_MS,
      status: (row.status ?? "open") as ConversationStatus,
      lastMessageText: row.lastMessageText,
      lastMessageSender: row.lastMessageSender,
      lastMessageImage: !!row.lastMessageImage,
      unread: Number(row.lastMessageAt) > Number(row.agentReadAt),
    };
  });
}

export async function markConversationRead(visitorId: string) {
  await ensureSchema();
  await sql`UPDATE conversations SET agent_read_at = ${Date.now()} WHERE visitor_id = ${visitorId}`;
}
