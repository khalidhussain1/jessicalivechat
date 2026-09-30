"use client";

import { useEffect, useRef, useState } from "react";
import { useNotificationSound, isSoundMuted, setSoundMuted } from "@/lib/use-notification-sound";
import { MessageTicks } from "@/components/MessageTicks";

type Conversation = {
  visitorId: string;
  visitorName: string | null;
  createdAt: number;
  lastMessageAt: number;
  agentReadAt: number;
  rungAt: number;
  lastMessageText: string | null;
  lastMessageSender: "user" | "agent" | null;
  lastMessageImage: boolean;
  unread: boolean;
};

type Message = {
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

type AgentInfo = { id: string; name: string };

const TYPING_THROTTLE_MS = 2000;
const POLL_INTERVAL_MS = 2000;
const TYPING_FRESH_MS = 4000;
const RING_ACTIVE_MS = 60_000;

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatRelativeTime(ms: number) {
  const diffSec = Math.floor((Date.now() - ms) / 1000);
  if (diffSec < 60) return "just now";
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function isRinging(rungAt: number) {
  return rungAt > 0 && Date.now() - rungAt < RING_ACTIVE_MS;
}

function initialsFor(label: string) {
  const parts = label.trim().split(/\s+/);
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return label.slice(0, 2).toUpperCase();
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

export default function AgentPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState("");
  const [selectedVisitorId, setSelectedVisitorId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [peerTyping, setPeerTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [muted, setMuted] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedVisitorIdRef = useRef<string | null>(null);
  const lastTypingSentAt = useRef(0);
  const lastMessageIdRef = useRef(0);
  const prevLastMessageAtRef = useRef<Record<string, number>>({});
  const prevRungAtRef = useRef<Record<string, number>>({});
  const hasPolledConversationsOnceRef = useRef(false);
  const { play, playUrgent, unlock } = useNotificationSound();

  useEffect(() => {
    selectedVisitorIdRef.current = selectedVisitorId;
    lastMessageIdRef.current = 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset thread state when switching conversations
    setMessages([]);
    setPeerTyping(false);
  }, [selectedVisitorId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable client-side
    setMuted(isSoundMuted());
    fetch("/api/agent/me")
      .then((res) => res.json())
      .then((data: { authenticated: boolean; agent: AgentInfo | null }) =>
        setAgent(data.authenticated ? data.agent : null),
      )
      .finally(() => setAuthChecked(true));
  }, []);

  // poll the conversation list continuously, regardless of which one is open
  useEffect(() => {
    if (!agent) return;
    let cancelled = false;

    async function pollConversations() {
      try {
        const res = await fetch("/api/agent/conversations");
        if (res.status === 401) {
          if (!cancelled) setAgent(null);
          return;
        }
        const data: { conversations: Conversation[] } = await res.json();
        if (cancelled) return;

        let shouldPlay = false;
        let shouldPlayUrgent = false;
        for (const c of data.conversations) {
          const prevMessageAt = prevLastMessageAtRef.current[c.visitorId];
          const isNewUserMessage = c.lastMessageSender === "user" && c.lastMessageAt !== prevMessageAt;
          if (
            hasPolledConversationsOnceRef.current &&
            isNewUserMessage &&
            c.visitorId !== selectedVisitorIdRef.current
          ) {
            shouldPlay = true;
          }
          prevLastMessageAtRef.current[c.visitorId] = c.lastMessageAt;

          const prevRungAt = prevRungAtRef.current[c.visitorId];
          if (hasPolledConversationsOnceRef.current && c.rungAt > 0 && c.rungAt !== prevRungAt) {
            shouldPlayUrgent = true;
          }
          prevRungAtRef.current[c.visitorId] = c.rungAt;
        }
        hasPolledConversationsOnceRef.current = true;
        if (shouldPlayUrgent) playUrgent();
        else if (shouldPlay) play();

        setConversations(data.conversations);
      } catch {
        // ignore transient network errors; next poll retries
      }
    }

    pollConversations();
    const interval = setInterval(pollConversations, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [agent, play, playUrgent]);

  // poll the open conversation's messages + typing status
  useEffect(() => {
    if (!agent || !selectedVisitorId) return;
    let cancelled = false;

    async function pollMessages() {
      try {
        const visible = document.visibilityState === "visible";
        const res = await fetch(
          `/api/agent/messages?visitorId=${selectedVisitorId}&afterId=${lastMessageIdRef.current}&visible=${visible}`,
        );
        if (res.status === 401) {
          if (!cancelled) setAgent(null);
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
  }, [agent, selectedVisitorId, play]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, peerTyping]);

  function selectConversation(visitorId: string) {
    setSelectedVisitorId(visitorId);
  }

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

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoginError(null);
    const res = await fetch("/api/agent/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setUsername("");
      setPassword("");
      setAgent(data.agent);
    } else {
      setLoginError(data?.error ?? "Login failed");
    }
  }

  async function handleLogout() {
    await fetch("/api/agent/logout", { method: "POST" });
    setAgent(null);
    setConversations([]);
    setSelectedVisitorId(null);
    setMessages([]);
  }

  if (!authChecked) {
    return <div className="px-6 py-16 text-center text-text-dim">Loading…</div>;
  }

  if (!agent) {
    return (
      <div className="mx-auto w-full max-w-sm px-6 py-24">
        <h1 className="text-2xl font-medium text-foreground">Agent sign in</h1>
        <p className="mt-2 text-sm text-text-dim">Sign in to reply to Jessica chats.</p>
        <form onSubmit={handleLogin} className="mt-6 space-y-3">
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Username"
            autoComplete="username"
            className="w-full rounded-full border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-text-faint focus:border-accent/50 focus:outline-none"
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className="w-full rounded-full border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-text-faint focus:border-accent/50 focus:outline-none"
          />
          {loginError && <p className="text-xs text-red-500">{loginError}</p>}
          <button
            type="submit"
            className="w-full rounded-full bg-accent px-5 py-3 text-base text-white transition hover:bg-accent-bright active:scale-[0.98]"
          >
            Sign in
          </button>
        </form>
      </div>
    );
  }

  const filteredConversations = conversations.filter((c) =>
    search.trim()
      ? c.visitorId.toLowerCase().includes(search.toLowerCase()) ||
        (c.lastMessageText ?? "").toLowerCase().includes(search.toLowerCase())
      : true,
  );
  const selectedConversation = conversations.find((c) => c.visitorId === selectedVisitorId);

  return (
    <div onClick={unlock} className="flex h-dvh w-full flex-col md:mx-auto md:h-auto md:max-w-5xl md:px-6 md:py-10">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 pt-[max(env(safe-area-inset-top),0.75rem)] md:mb-6 md:border-none md:px-0 md:pt-0">
        <div>
          <h1 className="text-lg font-medium text-foreground md:text-2xl">Jessica — Agent Inbox</h1>
          <p className="text-xs text-text-dim">Signed in as {agent.name}</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={toggleMute}
            title={muted ? "Unmute sound alerts" : "Mute sound alerts"}
            className="text-xl text-text-dim transition hover:text-accent-bright"
          >
            {muted ? "🔇" : "🔊"}
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-medium text-white">
            {agent.name.slice(0, 2).toUpperCase()}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-border px-4 py-2 text-xs text-text-dim transition hover:border-accent/40 hover:text-accent-bright"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden bg-panel md:h-[70vh] md:flex-none md:rounded-2xl md:border md:border-border md:shadow-lg md:shadow-black/10">
        <div
          className={`w-full shrink-0 flex-col border-border md:flex md:w-72 md:border-r ${
            selectedVisitorId ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="border-b border-border p-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search conversations…"
              className="w-full rounded-full border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-text-faint focus:border-accent/50 focus:outline-none"
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 && (
              <p className="px-4 py-6 text-xs text-text-faint">No conversations yet.</p>
            )}
            {filteredConversations.map((conversation) => (
              <button
                key={conversation.visitorId}
                type="button"
                onClick={() => selectConversation(conversation.visitorId)}
                className={`flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition hover:bg-panel-raised ${
                  selectedVisitorId === conversation.visitorId ? "bg-panel-raised" : ""
                } ${isRinging(conversation.rungAt) ? "bg-amber-500/10" : ""}`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-border text-[11px] font-medium text-text-dim">
                  {initialsFor(conversation.visitorName ?? conversation.visitorId)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-text-dim">
                      {conversation.visitorName ?? conversation.visitorId.slice(0, 8)}
                    </span>
                    {isRinging(conversation.rungAt) ? (
                      <span className="shrink-0 text-[10px] font-medium text-amber-600">
                        🔔 Ringing
                      </span>
                    ) : (
                      <span className="shrink-0 text-[10px] text-text-faint">
                        {formatRelativeTime(conversation.lastMessageAt)}
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
                      isRinging(conversation.rungAt) ? "animate-pulse bg-amber-500" : "bg-accent"
                    }`}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        <div
          className={`flex-1 flex-col md:flex ${selectedVisitorId ? "flex" : "hidden md:flex"}`}
        >
          {!selectedVisitorId ? (
            <div className="hidden flex-1 flex-col items-center justify-center gap-3 bg-panel-raised/40 text-text-faint md:flex">
              <span className="text-4xl">💬</span>
              <p className="text-sm">Select a conversation to reply</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-border px-4 py-3 md:px-6">
                <button
                  type="button"
                  onClick={() => setSelectedVisitorId(null)}
                  className="-ml-1 shrink-0 rounded-full p-1.5 text-text-dim hover:text-accent-bright md:hidden"
                  aria-label="Back to conversations"
                >
                  ←
                </button>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {selectedConversation?.visitorName ?? selectedVisitorId.slice(0, 8)}
                  </p>
                  <p className="text-xs text-text-faint">
                    {peerTyping ? "Typing…" : "Visitor"}
                  </p>
                </div>
              </div>

              {selectedConversation && isRinging(selectedConversation.rungAt) && (
                <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-700 md:px-6">
                  🔔 This customer rang for urgent help
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
                      <p>{message.text}</p>
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
                className="flex items-center gap-2 border-t border-border px-3 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] md:gap-3 md:px-4"
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
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-lg text-text-dim transition hover:border-accent/40 hover:text-accent-bright active:scale-95 disabled:opacity-50"
                >
                  {uploading ? "…" : "📷"}
                </button>
                <input
                  value={reply}
                  onChange={(event) => handleReplyChange(event.target.value)}
                  placeholder={`Reply as ${agent.name}…`}
                  className="h-11 flex-1 rounded-full border border-border bg-background px-4 text-base text-foreground placeholder:text-text-faint focus:border-accent/50 focus:outline-none"
                />
                <button
                  type="submit"
                  className="h-11 shrink-0 rounded-full bg-accent px-5 text-base text-white transition hover:bg-accent-bright active:scale-95 disabled:opacity-40"
                  disabled={!reply.trim()}
                >
                  Send
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
