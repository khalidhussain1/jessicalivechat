"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useNotificationSound, isSoundMuted, setSoundMuted } from "@/lib/use-notification-sound";

type Message = {
  id: number;
  visitorId: string;
  sender: "user" | "agent";
  senderName: string | null;
  text: string;
  imageUrl: string | null;
  createdAt: number;
};

const VISITOR_KEY = "jessica-visitor-id";
const GUEST_KEY = "jessica-guest-mode";
const TYPING_THROTTLE_MS = 2000;
const POLL_INTERVAL_MS = 2000;
const TYPING_FRESH_MS = 4000;

const quickActions = [
  "🔐 Account help",
  "🐛 Report a bug",
  "🎮 Game question",
  "💬 General question",
] as const;

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
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

function AuthGate({
  googleEnabled,
  onGuest,
}: {
  googleEnabled: boolean;
  onGuest: () => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === "signup") {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setError(data?.error ?? "Sign up failed");
          setSubmitting(false);
          return;
        }
      }

      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError("Incorrect email or password");
        setSubmitting(false);
      }
      // on success, useSession() picks up the new session automatically
    } catch {
      setError("Something went wrong. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 bg-panel px-8 text-center md:h-[70vh] md:max-h-[720px] md:flex-none md:rounded-2xl md:border md:border-border">
      <div>
        <p className="text-lg font-medium text-foreground">🎮 Jessica</p>
        <p className="mt-1 text-xs text-text-dim">
          Gamer support — sign in to keep your chat history, or continue as a guest.
        </p>
      </div>

      {googleEnabled && (
        <button
          type="button"
          onClick={() => signIn("google")}
          className="w-full max-w-xs rounded-full border border-border bg-panel-raised px-5 py-3 text-base text-foreground transition hover:border-accent/40 active:scale-[0.98]"
        >
          Continue with Google
        </button>
      )}

      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-2.5 text-left">
        {mode === "signup" && (
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name"
            required
            className="w-full rounded-full border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-text-faint focus:border-accent/50 focus:outline-none"
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          required
          className="w-full rounded-full border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-text-faint focus:border-accent/50 focus:outline-none"
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          required
          minLength={8}
          className="w-full rounded-full border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-text-faint focus:border-accent/50 focus:outline-none"
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-accent px-5 py-3 text-base text-white transition hover:bg-accent-bright active:scale-[0.98] disabled:opacity-50"
        >
          {mode === "signup" ? "Sign up" : "Sign in"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
        className="text-sm text-text-dim underline underline-offset-4 hover:text-accent-bright"
      >
        {mode === "signup" ? "Already have an account? Sign in" : "New here? Sign up"}
      </button>

      <button
        type="button"
        onClick={onGuest}
        className="text-sm text-text-faint underline underline-offset-4 hover:text-text-dim"
      >
        Continue as guest
      </button>
    </div>
  );
}

export function SupportChat() {
  const { data: session, status } = useSession();
  const [guestMode, setGuestMode] = useState<boolean | null>(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [connected, setConnected] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [muted, setMuted] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastTypingSentAt = useRef(0);
  const lastMessageIdRef = useRef(0);
  const { play, unlock } = useNotificationSound();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable client-side
    setGuestMode(window.localStorage.getItem(GUEST_KEY) === "1");
    setMuted(isSoundMuted());
    fetch("/api/auth/config")
      .then((res) => res.json())
      .then((data: { googleEnabled: boolean }) => setGoogleEnabled(data.googleEnabled))
      .catch(() => {});
  }, []);

  const displayName = session?.user?.name ?? "Guest";
  const showGate = status === "unauthenticated" && guestMode === false;
  const ready = status === "authenticated" || guestMode === true;

  useEffect(() => {
    if (!ready) return;

    let id: string;
    if (session?.user?.id) {
      id = session.user.id;
    } else {
      id = window.localStorage.getItem(VISITOR_KEY) ?? "";
      if (!id) {
        id = crypto.randomUUID();
        window.localStorage.setItem(VISITOR_KEY, id);
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- id is resolved from session/localStorage, not derivable during render
    setVisitorId(id);
    lastMessageIdRef.current = 0;
    setMessages([]);

    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/chat/history?visitorId=${id}&afterId=${lastMessageIdRef.current}`);
        const data: { messages: Message[]; agentTypingAt: number } = await res.json();
        if (cancelled) return;

        setConnected(true);
        if (data.messages.length > 0) {
          lastMessageIdRef.current = data.messages[data.messages.length - 1].id;
          setMessages((prev) => [
            ...prev,
            ...data.messages.filter((m) => !prev.some((p) => p.id === m.id)),
          ]);
          if (data.messages.some((m) => m.sender === "agent")) play();
        }
        setPeerTyping(Date.now() - data.agentTypingAt < TYPING_FRESH_MS);
      } catch {
        if (!cancelled) setConnected(false);
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [ready, session?.user?.id, play]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, peerTyping]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !visitorId) return;
    setDraft("");

    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId, text: trimmed, senderName: displayName }),
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

  function handleDraftChange(value: string) {
    setDraft(value);
    if (!visitorId) return;
    const now = Date.now();
    if (now - lastTypingSentAt.current > TYPING_THROTTLE_MS) {
      lastTypingSentAt.current = now;
      fetch("/api/chat/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId }),
      }).catch(() => {});
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !visitorId) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("visitorId", visitorId);
    formData.append("senderName", displayName);
    formData.append("file", file);

    try {
      const res = await fetch("/api/chat/upload", { method: "POST", body: formData });
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

  if (guestMode === null || status === "loading") {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-panel text-sm text-text-dim md:h-[70vh] md:max-h-[720px] md:flex-none md:rounded-2xl md:border md:border-border">
        Loading…
      </div>
    );
  }

  if (showGate) {
    return (
      <AuthGate
        googleEnabled={googleEnabled}
        onGuest={() => {
          window.localStorage.setItem(GUEST_KEY, "1");
          setGuestMode(true);
        }}
      />
    );
  }

  return (
    <div
      onClick={unlock}
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-panel md:h-[70vh] md:max-h-[720px] md:flex-none md:rounded-2xl md:border md:border-border"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3 pt-[max(env(safe-area-inset-top),0.75rem)] md:pt-3">
        <div>
          <p className="text-lg font-medium text-foreground">🎮 Jessica</p>
          <p className="text-xs text-text-dim">
            {connected ? `Chatting as ${displayName}` : "Connecting…"}
          </p>
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
          {session && (
            <button
              type="button"
              onClick={() => signOut({ redirect: false })}
              className="text-sm text-text-dim underline underline-offset-4 hover:text-accent-bright"
            >
              Sign out
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-border px-4 py-3">
        {quickActions.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => sendMessage(label)}
            className="shrink-0 rounded-full border border-accent/40 px-4 py-2 text-sm whitespace-nowrap text-accent-bright transition hover:border-accent hover:bg-accent/10 active:scale-[0.97]"
          >
            {label}
          </button>
        ))}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <div className="flex justify-start">
          <div className="max-w-[80%] rounded-2xl border border-border bg-panel-raised px-4 py-2.5 text-sm text-foreground">
            👾 You&apos;re chatting with Jessica, your gamer support crew. Send a message to get
            started.
          </div>
        </div>

        {messages.map((message) =>
          message.imageUrl ? (
            <div
              key={message.id}
              className={`flex flex-col ${message.sender === "user" ? "items-end" : "items-start"}`}
            >
              {message.sender === "agent" && (
                <p className="mb-0.5 text-[10px] tracking-wide text-accent-bright uppercase">
                  Jessica
                </p>
              )}
              <a href={message.imageUrl} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded, arbitrary dimensions */}
                <img
                  src={message.imageUrl}
                  alt="Shared attachment"
                  className="max-w-[220px] rounded-lg"
                />
              </a>
              <p className="mt-1 text-[10px] text-text-faint">{formatTime(message.createdAt)}</p>
            </div>
          ) : (
            <div
              key={message.id}
              className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  message.sender === "user"
                    ? "bg-accent text-white"
                    : "border border-border bg-panel-raised text-foreground"
                }`}
              >
                {message.sender === "agent" && (
                  <p className="mb-0.5 text-[10px] tracking-wide text-accent-bright uppercase">
                    Jessica
                  </p>
                )}
                <p>{message.text}</p>
                <p
                  className={`mt-1 text-[10px] ${
                    message.sender === "user" ? "text-white/60" : "text-text-faint"
                  }`}
                >
                  {formatTime(message.createdAt)}
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
          sendMessage(draft);
        }}
        className="flex items-center gap-2 border-t border-border px-3 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
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
          disabled={uploading || !visitorId}
          title="Attach an image"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-lg text-text-dim transition hover:border-accent/40 hover:text-accent-bright active:scale-95 disabled:opacity-50"
        >
          {uploading ? "…" : "📷"}
        </button>
        <input
          value={draft}
          onChange={(event) => handleDraftChange(event.target.value)}
          placeholder="Message Jessica…"
          className="h-11 flex-1 rounded-full border border-border bg-background px-4 text-base text-foreground placeholder:text-text-faint focus:border-accent/50 focus:outline-none"
        />
        <button
          type="submit"
          className="h-11 shrink-0 rounded-full bg-accent px-5 text-base text-white transition hover:bg-accent-bright active:scale-95 disabled:opacity-40"
          disabled={!draft.trim() || !visitorId}
        >
          Send
        </button>
      </form>
    </div>
  );
}
