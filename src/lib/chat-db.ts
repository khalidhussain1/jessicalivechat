import { sql, ensureSchema } from "@/lib/db";

export type ChatMessage = {
  id: number;
  visitorId: string;
  sender: "user" | "agent";
  senderName: string | null;
  text: string;
  imageUrl: string | null;
  createdAt: number;
};

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
  };
}

export async function getMessages(visitorId: string, afterId = 0): Promise<ChatMessage[]> {
  await ensureSchema();
  const rows = await sql`
    SELECT id, visitor_id as "visitorId", sender, sender_name as "senderName", text,
           image_url as "imageUrl", created_at as "createdAt"
    FROM messages WHERE visitor_id = ${visitorId} AND id > ${afterId} ORDER BY id ASC
  `;
  return rows.map((row) => ({ ...row, id: Number(row.id), createdAt: Number(row.createdAt) })) as ChatMessage[];
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
    SELECT visitor_typing_at as "visitorTypingAt", agent_typing_at as "agentTypingAt"
    FROM conversations WHERE visitor_id = ${visitorId}
  `;
  const row = rows[0];
  return {
    visitorTypingAt: row ? Number(row.visitorTypingAt) : 0,
    agentTypingAt: row ? Number(row.agentTypingAt) : 0,
  };
}

export type ConversationSummary = {
  visitorId: string;
  visitorName: string | null;
  createdAt: number;
  lastMessageAt: number;
  agentReadAt: number;
  visitorTypingAt: number;
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
      (SELECT m.sender_name FROM messages m
        WHERE m.visitor_id = c.visitor_id AND m.sender = 'user' AND m.sender_name IS NOT NULL
        ORDER BY m.id DESC LIMIT 1) as "visitorName",
      (SELECT m.text FROM messages m WHERE m.visitor_id = c.visitor_id ORDER BY m.id DESC LIMIT 1) as "lastMessageText",
      (SELECT m.sender FROM messages m WHERE m.visitor_id = c.visitor_id ORDER BY m.id DESC LIMIT 1) as "lastMessageSender",
      (SELECT m.image_url FROM messages m WHERE m.visitor_id = c.visitor_id ORDER BY m.id DESC LIMIT 1) as "lastMessageImage"
    FROM conversations c
    ORDER BY c.last_message_at DESC
  `;

  return rows.map((row) => ({
    visitorId: row.visitorId,
    visitorName: row.visitorName,
    createdAt: Number(row.createdAt),
    lastMessageAt: Number(row.lastMessageAt),
    agentReadAt: Number(row.agentReadAt),
    visitorTypingAt: Number(row.visitorTypingAt),
    lastMessageText: row.lastMessageText,
    lastMessageSender: row.lastMessageSender,
    lastMessageImage: !!row.lastMessageImage,
    unread: Number(row.lastMessageAt) > Number(row.agentReadAt),
  }));
}

export async function markConversationRead(visitorId: string) {
  await ensureSchema();
  await sql`UPDATE conversations SET agent_read_at = ${Date.now()} WHERE visitor_id = ${visitorId}`;
}
