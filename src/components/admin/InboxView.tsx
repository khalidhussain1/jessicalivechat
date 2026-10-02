"use client";

import { useEffect, useRef, useState } from "react";
import { MessageTicks } from "@/components/MessageTicks";
import { StatusDot } from "@/components/StatusDot";
import { CustomerPanel } from "@/components/admin/CustomerPanel";
import { formatTime, formatRelativeTime, initialsFor } from "@/lib/format";
import type {
  AgentInfo,
  Conversation,
  ConversationPriority,
  ConversationStatus,
  Message,
  Tag,
} from "@/components/admin/types";

const TYPING_THROTTLE_MS = 2000;
const POLL_INTERVAL_MS = 2000;
const TYPING_FRESH_MS = 4000;
const SEARCH_DEBOUNCE_MS = 300;

type FilterKey = "all" | "unread" | "open" | "pending" | "resolved" | "priority" | "unassigned" | "mine";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "open", label: "Open" },
  { key: "pending", label: "Pending" },
  { key: "resolved", label: "Resolved" },
  { key: "priority", label: "Priority" },
  { key: "unassigned", label: "Unassigned" },
  { key: "mine", label: "My Conversations" },
];

function statusBadge(status: ConversationStatus) {
  if (status === "resolved") return { label: "Resolved", className: "bg-border text-text-dim" };
  if (status === "pending")
    return { label: "Pending", className: "bg-amber-500/15 text-amber-700" };
  return null;
}

function priorityDot(priority: ConversationPriority) {
  if (priority === "urgent") return "bg-red-500";
  if (priority === "high") return "bg-amber-500";
  return null;
}

function TypingDots() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-panel-raised px-4 py-3">
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-text-dim" />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-text-dim" />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-text-dim" />
      </div>
    </div>
  );
}

type InboxViewProps = {
  agent: AgentInfo;
  conversations: Conversation[];
  selectedVisitorId: string | null;
  setSelectedVisitorId: (id: string | null) => void;
  dismissRing: (visitorId?: string) => void;
  setStatus: (visitorId: string, status: ConversationStatus) => void;
  patchConversation: (visitorId: string, patch: Partial<Conversation>) => void;
  play: () => void;
  onUnauthorized: () => void;
};

type RosterAgent = { id: string; name: string };
type CannedReply = { id: number; category: string; text: string };

export function InboxView({
  agent,
  conversations,
  selectedVisitorId,
  setSelectedVisitorId,
  dismissRing,
  setStatus,
  patchConversation,
  play,
  onUnauthorized,
}: InboxViewProps) {
  const [search, setSearch] = useState("");
  const [filterKey, setFilterKey] = useState<FilterKey>("all");
  const [serverSearchIds, setServerSearchIds] = useState<Set<string> | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [peerTyping, setPeerTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const [roster, setRoster] = useState<RosterAgent[]>([]);
  const [cannedReplies, setCannedReplies] = useState<CannedReply[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [showCannedPicker, setShowCannedPicker] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastTypingSentAt = useRef(0);
  const lastMessageIdRef = useRef(0);

  useEffect(() => {
    fetch("/api/agent/tags").then((res) => res.json()).then((d: { tags: Tag[] }) => setTags(d.tags)).catch(() => {});
    fetch("/api/agent/roster").then((res) => res.json()).then((d: { agents: RosterAgent[] }) => setRoster(d.agents)).catch(() => {});
    fetch("/api/admin/canned-replies")
      .then((res) => (res.ok ? res.json() : { cannedReplies: [] }))
      .then((d: { cannedReplies: CannedReply[] }) => setCannedReplies(d.cannedReplies ?? []))
      .catch(() => {});
  }, []);

  // full-history message search, debounced — supplements the client-side name/last-message/ticket match below
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale search results once the query is too short to search
      setServerSearchIds(null);
      return;
    }
    const timeout = setTimeout(() => {
      fetch(`/api/agent/search?q=${encodeURIComponent(q)}`)
        .then((res) => res.json())
        .then((d: { visitorIds: string[] }) => setServerSearchIds(new Set(d.visitorIds)))
        .catch(() => {});
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [search]);

  async function setPriority(visitorId: string, priority: ConversationPriority) {
    patchConversation(visitorId, { priority });
    await fetch("/api/agent/conversation/priority", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, priority }),
    }).catch(() => {});
  }

  async function assign(visitorId: string, agentId: string | null) {
    patchConversation(visitorId, { assignedAgentId: agentId });
    await fetch("/api/agent/conversation/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, agentId }),
    }).catch(() => {});
  }

  async function addTag(visitorId: string, tagId: number) {
    const current = conversations.find((c) => c.visitorId === visitorId);
    if (current) patchConversation(visitorId, { tagIds: [...current.tagIds, tagId] });
    await fetch("/api/agent/conversation/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, tagId }),
    }).catch(() => {});
  }

  async function removeTag(visitorId: string, tagId: number) {
    const current = conversations.find((c) => c.visitorId === visitorId);
    if (current) patchConversation(visitorId, { tagIds: current.tagIds.filter((id) => id !== tagId) });
    await fetch("/api/agent/conversation/tags", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, tagId }),
    }).catch(() => {});
  }

  async function createTag(name: string): Promise<Tag | null> {
    const res = await fetch("/api/agent/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return null;
    const data: { tag: Tag } = await res.json();
    setTags((prev) => (prev.some((t) => t.id === data.tag.id) ? prev : [...prev, data.tag]));
    return data.tag;
  }

  async function toggleRead(visitorId: string, makeUnread: boolean) {
    patchConversation(visitorId, { unread: makeUnread });
    await fetch("/api/agent/conversation/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, read: !makeUnread }),
    }).catch(() => {});
  }

  function insertCannedReply(text: string) {
    setReply((prev) => (prev ? `${prev}\n${text}` : text));
    setShowCannedPicker(false);
  }

  useEffect(() => {
    lastMessageIdRef.current = 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset thread state when switching conversations
    setMessages([]);
    setPeerTyping(false);
  }, [selectedVisitorId]);

  // poll the open conversation's messages + typing status
  useEffect(() => {
    if (!selectedVisitorId) return;
    let cancelled = false;

    async function pollMessages() {
      try {
        const visible = document.visibilityState === "visible";
        const res = await fetch(
          `/api/agent/messages?visitorId=${selectedVisitorId}&afterId=${lastMessageIdRef.current}&visible=${visible}`,
        );
        if (res.status === 401) {
          if (!cancelled) onUnauthorized();
          return;
        }
        const data: {
          messages: Message[];
          statusUpdates: Message[];
          visitorTypingAt: number;
        } = await res.json();
        if (cancelled) return;

        if (data.messages.length > 0) {
          lastMessageIdRef.current = data.messages[data.messages.length - 1].id;
        }
        if (data.messages.length > 0 || data.statusUpdates.length > 0) {
          setMessages((prev) => {
            const merged = [
              ...prev,
              ...data.messages.filter((m) => !prev.some((p) => p.id === m.id)),
            ];
            return merged.map((m) => {
              const update = data.statusUpdates.find((u) => u.id === m.id);
              return update ? { ...m, deliveredAt: update.deliveredAt, readAt: update.readAt } : m;
            });
          });
          if (data.messages.some((m) => m.sender === "user")) play();
        }
        setPeerTyping(Date.now() - data.visitorTypingAt < TYPING_FRESH_MS);
      } catch {
        // ignore transient network errors; next poll retries
      }
    }

    pollMessages();
    const interval = setInterval(pollMessages, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedVisitorId, play, onUnauthorized]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, peerTyping]);

  async function sendReply() {
    const text = reply.trim();
    if (!text || !selectedVisitorId) return;
    setReply("");
    try {
      const res = await fetch("/api/agent/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: selectedVisitorId, text }),
      });
      const data: { message: Message } = await res.json();
      if (data?.message) {
        setMessages((prev) =>
          prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message],
        );
        lastMessageIdRef.current = Math.max(lastMessageIdRef.current, data.message.id);
      }
    } catch {
      // the next poll will pick it up if the request actually succeeded server-side
    }
  }

  function handleReplyChange(value: string) {
    setReply(value);
    if (!selectedVisitorId) return;
    const now = Date.now();
    if (now - lastTypingSentAt.current > TYPING_THROTTLE_MS) {
      lastTypingSentAt.current = now;
      fetch("/api/agent/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: selectedVisitorId }),
      }).catch(() => {});
    }
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendReply();
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedVisitorId) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("visitorId", selectedVisitorId);
    formData.append("file", file);
    try {
      const res = await fetch("/api/agent/upload", { method: "POST", body: formData });
      const data: { message: Message } = await res.json();
      if (data?.message) {
        setMessages((prev) =>
          prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message],
        );
        lastMessageIdRef.current = Math.max(lastMessageIdRef.current, data.message.id);
      }
    } catch {
      // ignore; the next poll will pick it up if the upload actually succeeded
    }
    setUploading(false);
  }

  const filteredConversations = conversations
    .filter((c) => {
      if (filterKey === "unread") return c.unread;
      if (filterKey === "open" || filterKey === "pending" || filterKey === "resolved") return c.status === filterKey;
      if (filterKey === "priority") return c.priority === "high" || c.priority === "urgent";
      if (filterKey === "unassigned") return !c.assignedAgentId;
      if (filterKey === "mine") return c.assignedAgentId === agent.id;
      return true;
    })
    .filter((c) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const localMatch =
        (c.visitorName ?? c.visitorId).toLowerCase().includes(q) ||
        (c.lastMessageText ?? "").toLowerCase().includes(q) ||
        `#${c.ticketNo}`.includes(q) ||
        c.visitorId.toLowerCase().includes(q);
      return localMatch || (serverSearchIds?.has(c.visitorId) ?? false);
    });
  const selectedConversation = conversations.find((c) => c.visitorId === selectedVisitorId);

  return (
    <div className="flex flex-1 overflow-hidden bg-panel md:h-[70vh] md:flex-none md:rounded-2xl md:border md:border-border md:shadow-lg md:shadow-black/10">
      <div
        className={`w-full shrink-0 flex-col border-border md:flex md:w-72 md:border-r ${
          selectedVisitorId ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="space-y-2 border-b border-border p-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search conversations…"
            aria-label="Search conversations"
            className="w-full rounded-full border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-text-faint focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none focus:border-accent/50"
          />
          <div className="flex gap-1.5 overflow-x-auto">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilterKey(f.key)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs whitespace-nowrap transition ${
                  filterKey === f.key
                    ? "bg-accent text-white"
                    : "bg-panel-raised text-text-dim hover:text-accent-bright"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 && (
            <p className="px-4 py-6 text-xs text-text-faint">No conversations yet.</p>
          )}
          {filteredConversations.map((conversation) => {
            const badge = statusBadge(conversation.status);
            return (
              <button
                key={conversation.visitorId}
                type="button"
                onClick={() => setSelectedVisitorId(conversation.visitorId)}
                className={`flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition hover:bg-panel-raised ${
                  selectedVisitorId === conversation.visitorId ? "bg-panel-raised" : ""
                } ${conversation.ringActive ? "bg-amber-500/10" : ""}`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-border text-[11px] font-medium text-text-dim">
                  {initialsFor(conversation.visitorName ?? conversation.visitorId)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium text-text-dim">
                      {conversation.visitorName ?? conversation.visitorId.slice(0, 8)}
                    </span>
                    {conversation.ringActive ? (
                      <span className="shrink-0 animate-pulse text-[10px] font-medium text-amber-600">
                        🔔 Ringing
                      </span>
                    ) : (
                      <span className="shrink-0 text-[10px] text-text-faint">
                        {formatRelativeTime(conversation.lastMessageAt)}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <StatusDot online={conversation.visitorOnline} />
                    {badge && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${badge.className}`}>
                        {badge.label}
                      </span>
                    )}
                    {priorityDot(conversation.priority) && (
                      <span className={`h-1.5 w-1.5 rounded-full ${priorityDot(conversation.priority)}`} aria-hidden="true" title={conversation.priority} />
                    )}
                    {conversation.tagIds.slice(0, 2).map((tagId) => {
                      const tag = tags.find((t) => t.id === tagId);
                      if (!tag) return null;
                      return (
                        <span key={tagId} className="rounded-full px-1.5 py-0.5 text-[9px] text-white" style={{ backgroundColor: tag.color }}>
                          {tag.name}
                        </span>
                      );
                    })}
                  </div>
                  <p
                    className={`mt-0.5 truncate text-sm ${
                      conversation.unread ? "font-medium text-foreground" : "text-text-dim"
                    }`}
                  >
                    {conversation.lastMessageSender === "agent" && "You: "}
                    {conversation.lastMessageImage
                      ? "📷 Photo"
                      : (conversation.lastMessageText ?? "—")}
                  </p>
                </div>
                {conversation.unread && (
                  conversation.unreadCount > 1 ? (
                    <span
                      className={`mt-1 flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[9px] font-medium text-white ${
                        conversation.ringActive ? "animate-pulse bg-amber-500" : "bg-accent"
                      }`}
                    >
                      {conversation.unreadCount}
                    </span>
                  ) : (
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        conversation.ringActive ? "animate-pulse bg-amber-500" : "bg-accent"
                      }`}
                    />
                  )
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className={`min-w-0 flex-1 flex-col md:flex ${selectedVisitorId ? "flex" : "hidden md:flex"}`}>
        {!selectedVisitorId ? (
          <div className="hidden flex-1 flex-col items-center justify-center gap-3 bg-panel-raised/40 text-text-faint md:flex">
            <span className="text-4xl">💬</span>
            <p className="text-sm">Select a conversation to reply</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 md:px-6">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedVisitorId(null)}
                  aria-label="Back to conversations"
                  className="-ml-1 shrink-0 rounded-full p-1.5 text-text-dim hover:text-accent-bright md:hidden"
                >
                  ←
                </button>
                <div className="min-w-0 overflow-hidden">
                  <p className="truncate text-sm font-medium text-foreground">
                    {selectedConversation?.visitorName ?? selectedVisitorId.slice(0, 8)}
                  </p>
                  {peerTyping ? (
                    <p className="truncate text-xs whitespace-nowrap text-text-faint">Typing…</p>
                  ) : (
                    <StatusDot online={!!selectedConversation?.visitorOnline} />
                  )}
                </div>
              </div>
              {selectedConversation && (
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  <span className="hidden text-[11px] text-text-faint sm:inline">#{selectedConversation.ticketNo}</span>
                  <button
                    type="button"
                    onClick={() => toggleRead(selectedConversation.visitorId, true)}
                    className="flex h-9 items-center rounded-full border border-border px-3 text-xs text-text-dim transition hover:border-accent/40 hover:text-accent-bright"
                  >
                    Mark unread
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPanel((v) => !v)}
                    aria-pressed={showPanel}
                    className={`flex h-9 items-center rounded-full border px-3 text-xs transition ${
                      showPanel ? "border-accent bg-accent/10 text-accent-bright" : "border-border text-text-dim hover:border-accent/40"
                    }`}
                  >
                    ℹ️ Details
                  </button>
                  {selectedConversation.status === "resolved" ? (
                    <button
                      type="button"
                      onClick={() => setStatus(selectedConversation.visitorId, "open")}
                      className="flex h-9 items-center rounded-full border border-border px-3 text-xs text-text-dim transition hover:border-accent/40 hover:text-accent-bright"
                    >
                      Reopen
                    </button>
                  ) : (
                    <>
                      {selectedConversation.status !== "pending" && (
                        <button
                          type="button"
                          onClick={() => setStatus(selectedConversation.visitorId, "pending")}
                          className="flex h-9 items-center rounded-full border border-border px-3 text-xs text-text-dim transition hover:border-amber-500/50 hover:text-amber-600"
                        >
                          Pending
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setStatus(selectedConversation.visitorId, "resolved")}
                        className="flex h-9 items-center rounded-full border border-border px-3 text-xs text-text-dim transition hover:border-accent/40 hover:text-accent-bright"
                      >
                        Resolve
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {selectedConversation?.ringActive && (
              <div className="flex items-center justify-between gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-700 md:px-6">
                <span>🔔 This customer rang for urgent help</span>
                <button
                  type="button"
                  onClick={() => dismissRing(selectedConversation.visitorId)}
                  className="flex h-8 shrink-0 items-center rounded-full bg-amber-600 px-3 text-[11px] text-white transition hover:bg-amber-700"
                >
                  STOP RING
                </button>
              </div>
            )}

            <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 md:px-6">
              {messages.map((message) =>
                message.imageUrl ? (
                  <div
                    key={message.id}
                    className={`flex flex-col ${message.sender === "agent" ? "items-end" : "items-start"}`}
                  >
                    <a href={message.imageUrl} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded, arbitrary dimensions */}
                      <img
                        src={message.imageUrl}
                        alt="Shared attachment"
                        className="max-w-[220px] rounded-lg"
                      />
                    </a>
                    <p className="mt-1 flex items-center gap-1 text-[10px] text-text-faint">
                      {formatTime(message.createdAt)}
                      {message.sender === "agent" && (
                        <MessageTicks deliveredAt={message.deliveredAt} readAt={message.readAt} />
                      )}
                    </p>
                  </div>
                ) : (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === "agent" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                        message.sender === "agent"
                          ? "bg-accent text-white"
                          : "border border-border bg-panel-raised text-foreground"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.text}</p>
                      <p
                        className={`mt-1 flex items-center gap-1 text-[10px] ${
                          message.sender === "agent" ? "text-white/60" : "text-text-faint"
                        }`}
                      >
                        {formatTime(message.createdAt)}
                        {message.sender === "agent" && (
                          <MessageTicks deliveredAt={message.deliveredAt} readAt={message.readAt} />
                        )}
                      </p>
                    </div>
                  </div>
                ),
              )}
              {peerTyping && <TypingDots />}
            </div>

            {showCannedPicker && (
              <div className="max-h-40 shrink-0 overflow-y-auto border-t border-border bg-panel-raised px-3 py-2 md:px-4">
                {cannedReplies.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-text-faint">No canned replies yet — add some under Canned Replies.</p>
                ) : (
                  cannedReplies.map((cr) => (
                    <button
                      key={cr.id}
                      type="button"
                      onClick={() => insertCannedReply(cr.text)}
                      className="block w-full rounded-lg px-2 py-1.5 text-left text-xs text-text-dim hover:bg-panel"
                    >
                      <span className="text-text-faint">{cr.category}:</span> {cr.text}
                    </button>
                  ))
                )}
              </div>
            )}

            <form
              onSubmit={(event) => {
                event.preventDefault();
                sendReply();
              }}
              className="flex items-end gap-2 border-t border-border px-3 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] md:gap-3 md:px-4"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="Attach an image"
                aria-label="Attach an image"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-lg text-text-dim transition hover:border-accent/40 hover:text-accent-bright focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none active:scale-95 disabled:opacity-50"
              >
                {uploading ? "…" : "📷"}
              </button>
              <button
                type="button"
                onClick={() => setShowCannedPicker((v) => !v)}
                aria-pressed={showCannedPicker}
                title="Insert a canned reply"
                aria-label="Insert a canned reply"
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-lg transition focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none active:scale-95 ${
                  showCannedPicker ? "border-accent bg-accent/10 text-accent-bright" : "border-border text-text-dim hover:border-accent/40 hover:text-accent-bright"
                }`}
              >
                💬
              </button>
              <textarea
                value={reply}
                onChange={(event) => handleReplyChange(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder={`Reply as ${agent.name}…`}
                rows={1}
                aria-label="Reply message"
                className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-2.5 text-base text-foreground placeholder:text-text-faint focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none focus:border-accent/50"
              />
              <button
                type="submit"
                aria-label="Send reply"
                className="h-11 shrink-0 rounded-full bg-accent px-5 text-base text-white transition hover:bg-accent-bright focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none active:scale-95 disabled:opacity-40"
                disabled={!reply.trim()}
              >
                Send
              </button>
            </form>
            </div>
            {showPanel && selectedConversation && (
              <CustomerPanel
                conversation={selectedConversation}
                tags={tags}
                roster={roster}
                onClose={() => setShowPanel(false)}
                onSetPriority={setPriority}
                onAssign={assign}
                onAddTag={addTag}
                onRemoveTag={removeTag}
                onCreateTag={createTag}
              />
            )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
