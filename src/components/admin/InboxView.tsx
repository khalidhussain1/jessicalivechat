"use client";

import { useEffect, useRef, useState } from "react";
import { MessageTicks } from "@/components/MessageTicks";
import { StatusDot } from "@/components/StatusDot";
import { formatTime, formatRelativeTime, initialsFor } from "@/lib/format";
import type { AgentInfo, Conversation, ConversationStatus, Message } from "@/components/admin/types";

const TYPING_THROTTLE_MS = 2000;
const POLL_INTERVAL_MS = 2000;
const TYPING_FRESH_MS = 4000;

const STATUS_FILTERS: { key: "all" | ConversationStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "pending", label: "Pending" },
  { key: "resolved", label: "Resolved" },
];

function statusBadge(status: ConversationStatus) {
  if (status === "resolved") return { label: "Resolved", className: "bg-border text-text-dim" };
  if (status === "pending")
    return { label: "Pending", className: "bg-amber-500/15 text-amber-700" };
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
  play: () => void;
  onUnauthorized: () => void;
};

export function InboxView({
  agent,
  conversations,
  selectedVisitorId,
  setSelectedVisitorId,
  dismissRing,
  setStatus,
  play,
  onUnauthorized,
}: InboxViewProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ConversationStatus>("all");
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [peerTyping, setPeerTyping] = useState(false);
  const [uploading, setUploading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastTypingSentAt = useRef(0);
  const lastMessageIdRef = useRef(0);

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
    .filter((c) => statusFilter === "all" || c.status === statusFilter)
    .filter((c) =>
      search.trim()
        ? (c.visitorName ?? c.visitorId).toLowerCase().includes(search.toLowerCase()) ||
          (c.lastMessageText ?? "").toLowerCase().includes(search.toLowerCase())
        : true,
    );
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
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs transition ${
                  statusFilter === f.key
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
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <StatusDot online={conversation.visitorOnline} />
                    {badge && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${badge.className}`}>
                        {badge.label}
                      </span>
                    )}
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
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      conversation.ringActive ? "animate-pulse bg-amber-500" : "bg-accent"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className={`flex-1 flex-col md:flex ${selectedVisitorId ? "flex" : "hidden md:flex"}`}>
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
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {selectedConversation?.visitorName ?? selectedVisitorId.slice(0, 8)}
                  </p>
                  {peerTyping ? (
                    <p className="text-xs text-text-faint">Typing…</p>
                  ) : (
                    <StatusDot online={!!selectedConversation?.visitorOnline} />
                  )}
                </div>
              </div>
              {selectedConversation && (
                <div className="flex shrink-0 gap-1.5">
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
          </>
        )}
      </div>
    </div>
  );
}
