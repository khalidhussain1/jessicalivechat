export type ConversationStatus = "open" | "pending" | "resolved";

export type Conversation = {
  visitorId: string;
  visitorName: string | null;
  createdAt: number;
  lastMessageAt: number;
  agentReadAt: number;
  rungAt: number;
  ringActive: boolean;
  visitorOnline: boolean;
  status: ConversationStatus;
  lastMessageText: string | null;
  lastMessageSender: "user" | "agent" | null;
  lastMessageImage: boolean;
  unread: boolean;
};

export type Message = {
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

export type AgentRole = "agent" | "admin" | "super_admin";

export type AgentInfo = { id: string; name: string; role: AgentRole };

export const ROLE_RANK: Record<AgentRole, number> = { agent: 0, admin: 1, super_admin: 2 };

export function hasRole(agent: AgentInfo | null, minRole: AgentRole): boolean {
  return !!agent && ROLE_RANK[agent.role] >= ROLE_RANK[minRole];
}

export function roleLabel(role: AgentRole): string {
  if (role === "super_admin") return "Super Admin";
  if (role === "admin") return "Admin";
  return "Agent";
}
