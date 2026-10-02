"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useNotificationSound, isSoundMuted, setSoundMuted } from "@/lib/use-notification-sound";
import { MessageTicks } from "@/components/MessageTicks";
import { ProfileModal } from "@/components/ProfileModal";
import { JessicaAvatar } from "@/components/JessicaAvatar";
import { StatusDot } from "@/components/StatusDot";
import { useTheme } from "@/lib/use-theme";
import {
  notificationPermission,
  requestNotificationPermission,
  showNotification,
} from "@/lib/use-browser-notifications";

type Appearance = {
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

type SupportAvailability = {
  status: "online" | "offline" | "away";
  offlineMessage: string;
};

// mirrors today's hardcoded values — used until an admin saves settings, and as a
// fallback if the settings fetch fails, so nothing visually changes by default
const DEFAULT_APPEARANCE: Appearance = {
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

const DEFAULT_SUPPORT_AVAILABILITY: SupportAvailability = {
  status: "online",
  offlineMessage: "Support is currently offline. You can still leave a message and we'll get back to you.",
};

type MaintenanceMode = { enabled: boolean; message: string };
const DEFAULT_MAINTENANCE: MaintenanceMode = {
  enabled: false,
  message: "We're currently performing a quick update. Please check back shortly.",
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
  pending?: boolean;
  failed?: boolean;
};

type QuickQuestion = { id: number; icon: string; label: string; message: string };
type AnnouncementType = "info" | "success" | "warning" | "important";
type Announcement = {
  id: number;
  text: string;
  type: AnnouncementType;
  dismissible: boolean;
  linkLabel: string | null;
  linkUrl: string | null;
};
type Faq = { id: number; question: string; answer: string };

const DISMISSED_ANNOUNCEMENTS_KEY = "jessica-dismissed-announcements";

const ANNOUNCEMENT_STYLES: Record<AnnouncementType, { icon: string; className: string }> = {
  info: { icon: "🔔", className: "border-border bg-panel-raised text-text-dim" },
  success: { icon: "✅", className: "border-accent/30 bg-accent/10 text-accent-bright" },
  warning: { icon: "⚠️", className: "border-amber-500/30 bg-amber-500/10 text-amber-700" },
  important: { icon: "📢", className: "border-red-500/30 bg-red-500/10 text-red-600" },
};

const VISITOR_KEY = "jessica-visitor-id";
const GUEST_KEY = "jessica-guest-mode";
const TYPING_THROTTLE_MS = 2000;
const POLL_INTERVAL_MS = 2000;
const TYPING_FRESH_MS = 4000;
const RING_COOLDOWN_MS = 30_000;
const NEAR_BOTTOM_PX = 80;

// fallback used only if /api/content/public hasn't returned yet or fails — keeps the
// exact same buttons/text/behavior customers already see today, "Game question" included
const DEFAULT_QUICK_QUESTIONS: QuickQuestion[] = [
  { id: -1, icon: "👤", label: "I need account?", message: "👤 I need account?" },
  { id: -2, icon: "💳", label: "Payment method?", message: "💳 Payment method?" },
  { id: -3, icon: "💬", label: "Is anyone available to chat?", message: "💬 Is anyone available to chat?" },
  { id: -4, icon: "🎮", label: "Game question", message: "🎮 Game question" },
];

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDateSeparator(ms: number) {
  const date = new Date(ms);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
}

function parseQuote(text: string): { quote: string | null; body: string } {
  if (text.startsWith("> ")) {
    const newlineIndex = text.indexOf("\n");
    if (newlineIndex !== -1) {
      return { quote: text.slice(2, newlineIndex), body: text.slice(newlineIndex + 1) };
    }
  }
  return { quote: null, body: text };
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
  appearance,
  onGuest,
}: {
  googleEnabled: boolean;
  appearance: Appearance;
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
      <div className="flex flex-col items-center gap-2">
        <JessicaAvatar size={56} imageUrl={appearance.avatarUrl ?? appearance.logoUrl} />
        <div>
          <p className="text-lg font-medium text-foreground">{appearance.supportName}</p>
          <p className="text-xs text-text-dim">{appearance.supportSubtitle}</p>
        </div>
        <p className="mt-1 max-w-xs text-xs text-text-dim">
          Sign in to keep your chat history, or continue as a guest.
        </p>
      </div>

      {googleEnabled && (
        <button
          type="button"
          onClick={() => signIn("google")}
          className="w-full max-w-xs rounded-full border border-border bg-panel-raised px-5 py-3 text-base text-foreground transition hover:border-accent/40 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none active:scale-[0.98]"
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
            aria-label="Name"
            className="w-full rounded-full border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-text-faint focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none focus:border-accent/50"
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          required
          aria-label="Email"
          className="w-full rounded-full border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-text-faint focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none focus:border-accent/50"
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          required
          minLength={8}
          aria-label="Password"
          className="w-full rounded-full border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-text-faint focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none focus:border-accent/50"
        />
        {error && (
          <p role="alert" className="text-xs text-red-500">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-accent px-5 py-3 text-base text-white transition hover:bg-accent-bright focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none active:scale-[0.98] disabled:opacity-50"
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
  const { data: session, status, update: updateSession } = useSession();
  const { theme, toggleTheme } = useTheme();
  const [showProfile, setShowProfile] = useState(false);
  const [guestMode, setGuestMode] = useState<boolean | null>(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [appearance, setAppearance] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [availability, setAvailability] = useState<SupportAvailability>(DEFAULT_SUPPORT_AVAILABILITY);
  const [maintenance, setMaintenance] = useState<MaintenanceMode>(DEFAULT_MAINTENANCE);
  const [quickQuestions, setQuickQuestions] = useState<QuickQuestion[]>(DEFAULT_QUICK_QUESTIONS);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedAnnouncementIds, setDismissedAnnouncementIds] = useState<number[]>([]);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [showFaqs, setShowFaqs] = useState(false);

  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [connected, setConnected] = useState(false);
  const [agentOnline, setAgentOnline] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [muted, setMuted] = useState(false);
  const [ringCooldownUntil, setRingCooldownUntil] = useState(0);
  const [ringRemainingMs, setRingRemainingMs] = useState(0);
  const [ringActive, setRingActive] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [copiedId, setCopiedId] = useState<number | string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [unviewedCount, setUnviewedCount] = useState(0);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(
    "default",
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastTypingSentAt = useRef(0);
  const lastMessageIdRef = useRef(0);
  const nearBottomRef = useRef(true);
  const lastNotifiedIdRef = useRef(0);
  const { play, unlock } = useNotificationSound();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable client-side
    setGuestMode(window.localStorage.getItem(GUEST_KEY) === "1");
    setMuted(isSoundMuted());
    setNotifPermission(notificationPermission());
    fetch("/api/auth/config")
      .then((res) => res.json())
      .then((data: { googleEnabled: boolean }) => setGoogleEnabled(data.googleEnabled))
      .catch(() => {});
    fetch("/api/settings/public")
      .then((res) => res.json())
      .then((data: {
        appearance?: Partial<Appearance>;
        support_availability?: Partial<SupportAvailability>;
        maintenance?: Partial<MaintenanceMode>;
      }) => {
        if (data.appearance) setAppearance((prev) => ({ ...prev, ...data.appearance }));
        if (data.support_availability) setAvailability((prev) => ({ ...prev, ...data.support_availability }));
        if (data.maintenance) setMaintenance((prev) => ({ ...prev, ...data.maintenance }));
      })
      .catch(() => {});
    fetch("/api/content/public")
      .then((res) => res.json())
      .then((data: { quickQuestions?: QuickQuestion[]; announcements?: Announcement[]; faqs?: Faq[] }) => {
        if (data.quickQuestions?.length) setQuickQuestions(data.quickQuestions);
        if (data.announcements) setAnnouncements(data.announcements);
        if (data.faqs) setFaqs(data.faqs);
      })
      .catch(() => {});
    try {
      const raw = window.localStorage.getItem(DISMISSED_ANNOUNCEMENTS_KEY);
      if (raw) setDismissedAnnouncementIds(JSON.parse(raw));
    } catch {
      // ignore malformed/absent localStorage value
    }
  }, []);

  function dismissAnnouncement(id: number) {
    setDismissedAnnouncementIds((prev) => {
      const next = [...prev, id];
      window.localStorage.setItem(DISMISSED_ANNOUNCEMENTS_KEY, JSON.stringify(next));
      return next;
    });
  }

  const displayName = session?.user?.name ?? "Guest";
  const showGate = status === "unauthenticated" && guestMode === false;
  const ready = status === "authenticated" || guestMode === true;

  // only the *first* auth resolution should show the full-page loading state —
  // a later status flicker back to "loading" (e.g. from useSession().update())
  // must not unmount the whole chat (and whatever modal is open inside it)
  const [hasResolvedAuth, setHasResolvedAuth] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- latches once status first settles, ignoring later flickers
    if (status !== "loading") setHasResolvedAuth(true);
  }, [status]);

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
        const visible = document.visibilityState === "visible";
        const res = await fetch(
          `/api/chat/history?visitorId=${id}&afterId=${lastMessageIdRef.current}&visible=${visible}`,
        );
        const data: {
          messages: Message[];
          statusUpdates: Message[];
          agentTypingAt: number;
          rungAt: number;
          ringActive: boolean;
          agentOnline: boolean;
        } = await res.json();
        if (cancelled) return;

        setConnected(true);
        setAgentOnline(data.agentOnline);
        setRingActive(data.ringActive);

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

          const newAgentMessages = data.messages.filter((m) => m.sender === "agent");
          if (newAgentMessages.length > 0) {
            if (nearBottomRef.current) {
              play();
            } else {
              setNewMessageCount((n) => n + newAgentMessages.length);
            }

            if (!visible) {
              setUnviewedCount((n) => n + newAgentMessages.length);
            }

            const latest = newAgentMessages[newAgentMessages.length - 1];
            if (!visible && latest.id !== lastNotifiedIdRef.current) {
              lastNotifiedIdRef.current = latest.id;
              showNotification(`${appearance.supportName} sent you a message`, parseQuote(latest.text).body || "📷 Photo");
            }
          }
        }
        setPeerTyping(Date.now() - data.agentTypingAt < TYPING_FRESH_MS);
        if (data.rungAt > 0) {
          setRingCooldownUntil((prev) => Math.max(prev, data.rungAt + RING_COOLDOWN_MS));
        }
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
  }, [ready, session?.user?.id, play, appearance.supportName]);

  // "customer opens the conversation -> unread messages are marked as read -> badge clears"
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        setUnviewedCount(0);
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // App Badge API (Android/desktop PWA installs) with graceful fallbacks: a page-title
  // prefix and a redrawn favicon dot — neither requires any paid push/badge service.
  // iOS Safari has no App Badge API at all, even when installed; the title/favicon
  // fallbacks still work there since they're plain DOM/tab-level updates.
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (count?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    try {
      if (unviewedCount > 0) nav.setAppBadge?.(unviewedCount);
      else nav.clearAppBadge?.();
    } catch {
      // App Badge API can throw even when present (e.g. not installed as a PWA) — fall through to the other indicators below
    }

    const baseTitle = `${appearance.supportName} Chat`;
    document.title = unviewedCount > 0 ? `(${unviewedCount}) ${baseTitle}` : baseTitle;

    let link = document.querySelector<HTMLLinkElement>("link[rel='icon'][data-dynamic]");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      link.dataset.dynamic = "true";
      document.head.appendChild(link);
    }
    if (unviewedCount === 0) {
      link.href = "/icons/icon-192.png";
      return;
    }
    const img = new Image();
    img.src = "/icons/icon-192.png";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 48;
      canvas.height = 48;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 48, 48);
      ctx.beginPath();
      ctx.arc(38, 10, 10, 0, Math.PI * 2);
      ctx.fillStyle = "#dc2626";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      if (link) link.href = canvas.toDataURL("image/png");
    };
  }, [unviewedCount, appearance.supportName]);

  useEffect(() => {
    function update() {
      setRingRemainingMs(Math.max(0, ringCooldownUntil - Date.now()));
    }
    update();
    if (ringCooldownUntil <= Date.now()) return;
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [ringCooldownUntil]);

  useEffect(() => {
    if (nearBottomRef.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, peerTyping]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = distanceFromBottom < NEAR_BOTTOM_PX;
    nearBottomRef.current = near;
    setShowScrollButton(!near);
    if (near) setNewMessageCount(0);
  }

  function scrollToBottom() {
    nearBottomRef.current = true;
    setNewMessageCount(0);
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }

  async function sendMessage(text: string, quickQuestionId?: number) {
    const trimmed = text.trim();
    if (!trimmed || !visitorId) return;

    const outgoing = replyingTo ? `> ${parseQuote(replyingTo.text).body.slice(0, 80)}\n${trimmed}` : trimmed;
    setDraft("");
    setReplyingTo(null);

    // eslint-disable-next-line react-hooks/purity -- this runs inside an event handler (a user clicking Send), never during render
    const tempId = -Date.now();
    const optimistic: Message = {
      id: tempId,
      visitorId,
      sender: "user",
      senderName: displayName,
      text: outgoing,
      imageUrl: null,
      // eslint-disable-next-line react-hooks/purity -- event-handler timestamp for an optimistic message, not a render value
      createdAt: Date.now(),
      deliveredAt: null,
      readAt: null,
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);

    await sendToServer(tempId, outgoing, quickQuestionId);
  }

  async function sendToServer(tempId: number, text: string, quickQuestionId?: number) {
    if (!visitorId) return;
    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId, text, senderName: displayName, quickQuestionId }),
      });
      const data: { message: Message } = await res.json();
      if (!res.ok || !data?.message) throw new Error("send failed");
      setMessages((prev) => {
        // a slower, already-in-flight poll can independently discover this same message
        // (via its own afterId cursor) before this response replaces the optimistic
        // placeholder — if so, drop the placeholder instead of creating a duplicate id
        if (prev.some((m) => m.id === data.message.id)) {
          return prev.filter((m) => m.id !== tempId);
        }
        return prev.map((m) => (m.id === tempId ? { ...data.message } : m));
      });
      lastMessageIdRef.current = Math.max(lastMessageIdRef.current, data.message.id);
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)),
      );
    }
  }

  function retryMessage(message: Message) {
    setMessages((prev) =>
      prev.map((m) => (m.id === message.id ? { ...m, pending: true, failed: false } : m)),
    );
    sendToServer(message.id, message.text);
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

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(draft);
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

  async function handleEnableNotifications() {
    const permission = await requestNotificationPermission();
    setNotifPermission(permission);
  }

  async function copyMessage(message: Message) {
    try {
      await navigator.clipboard.writeText(parseQuote(message.text).body);
      setCopiedId(message.id);
      setTimeout(() => setCopiedId((id) => (id === message.id ? null : id)), 1500);
    } catch {
      // clipboard access can fail (permissions/unsupported) — not worth surfacing an error for
    }
  }

  async function handleRing() {
    if (!visitorId || Date.now() < ringCooldownUntil) return;
    try {
      const res = await fetch("/api/chat/ring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId }),
      });
      const data: { ok?: boolean; rungAt?: number; retryAfterMs?: number } = await res.json();
      if (res.ok && data.rungAt) {
        setRingCooldownUntil(data.rungAt + RING_COOLDOWN_MS);
        setRingActive(true);
      } else if (data.retryAfterMs) {
        setRingCooldownUntil(Date.now() + data.retryAfterMs);
      }
    } catch {
      // no-op; the button just stays enabled and they can try again
    }
  }

  function handleLogout() {
    signOut({ redirect: false });
    window.localStorage.removeItem(GUEST_KEY);
    setGuestMode(false);
    setMessages([]);
    setVisitorId(null);
    lastMessageIdRef.current = 0;
  }

  const ringOnCooldown = ringRemainingMs > 0;

  if (maintenance.enabled) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-panel px-8 text-center md:h-[70vh] md:max-h-[720px] md:flex-none md:rounded-2xl md:border md:border-border">
        <span className="text-4xl" aria-hidden="true">🛠️</span>
        <p className="max-w-xs text-sm text-text-dim">{maintenance.message}</p>
      </div>
    );
  }

  if (guestMode === null || !hasResolvedAuth) {
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
        appearance={appearance}
        onGuest={() => {
          window.localStorage.setItem(GUEST_KEY, "1");
          setGuestMode(true);
        }}
      />
    );
  }

  const themeVars = {
    "--color-accent": appearance.primaryColor,
    "--color-accent-bright": appearance.secondaryColor,
    "--background": appearance.backgroundColor,
  } as React.CSSProperties;

  return (
    <div
      onClick={unlock}
      style={themeVars}
      className="theme-transition flex min-h-0 flex-1 flex-col overflow-hidden bg-panel md:h-[70vh] md:max-h-[720px] md:flex-none md:rounded-2xl md:border md:border-border"
    >
      {availability.status !== "online" && (
        <div
          role="status"
          className={`shrink-0 border-b px-4 py-2 text-xs font-medium ${
            availability.status === "away"
              ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
              : "border-border bg-panel-raised text-text-dim"
          }`}
        >
          {availability.status === "away"
            ? "🟡 Support is away right now — replies may be delayed."
            : `🔴 ${availability.offlineMessage}`}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 pt-[max(env(safe-area-inset-top),0.75rem)] md:pt-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <JessicaAvatar size={40} imageUrl={appearance.avatarUrl ?? appearance.logoUrl} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-base font-medium text-foreground">{appearance.supportName}</p>
              <span className="hidden shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent-bright sm:inline-flex">
                {appearance.supportSubtitle}
              </span>
            </div>
            {connected ? (
              <StatusDot online={agentOnline} />
            ) : (
              <p className="text-xs text-text-dim">Connecting…</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2.5">
          <button
            type="button"
            onClick={handleRing}
            disabled={ringOnCooldown && !ringActive}
            title="Ring for urgent help"
            aria-label="Ring for urgent help"
            className={`flex h-9 shrink-0 items-center justify-center rounded-full border px-3 text-xs font-medium whitespace-nowrap transition focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none active:scale-95 ${
              ringActive
                ? "animate-pulse border-amber-500 bg-amber-500/10 text-amber-600"
                : ringOnCooldown
                  ? "border-border text-text-faint"
                  : "border-amber-500/50 text-amber-600 hover:border-amber-500 hover:bg-amber-500/10"
            }`}
          >
            {ringActive
              ? "🔔 Ringing…"
              : ringOnCooldown
                ? `🔔 ${Math.ceil(ringRemainingMs / 1000)}s`
                : "🔔 Ring"}
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg text-text-dim transition hover:text-accent-bright focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <button
            type="button"
            onClick={toggleMute}
            title={muted ? "Unmute sound alerts" : "Mute sound alerts"}
            aria-label={muted ? "Unmute sound alerts" : "Mute sound alerts"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg text-text-dim transition hover:text-accent-bright focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            {muted ? "🔇" : "🔊"}
          </button>
          {session && (
            <button
              type="button"
              onClick={() => setShowProfile(true)}
              title="Your profile"
              aria-label="Your profile"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg text-text-dim transition hover:text-accent-bright focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            >
              👤
            </button>
          )}
          {(session || guestMode) && (
            <button
              type="button"
              onClick={handleLogout}
              title="Log out"
              aria-label="Log out"
              className="flex h-9 shrink-0 items-center justify-center rounded-full px-2.5 text-sm text-text-dim underline underline-offset-4 transition hover:text-accent-bright focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            >
              Logout
            </button>
          )}
        </div>
      </div>

      {showProfile && (
        <ProfileModal
          onClose={() => setShowProfile(false)}
          onSaved={(newName) => updateSession({ name: newName })}
        />
      )}

      {announcements
        .filter((a) => !dismissedAnnouncementIds.includes(a.id))
        .map((a) => {
          const style = ANNOUNCEMENT_STYLES[a.type];
          return (
            <div
              key={a.id}
              role="status"
              className={`flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2 text-xs font-medium ${style.className}`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden="true">{style.icon}</span>
                <span className="truncate">{a.text}</span>
                {a.linkUrl && a.linkLabel && (
                  <a href={a.linkUrl} target="_blank" rel="noreferrer" className="shrink-0 underline underline-offset-2">
                    {a.linkLabel}
                  </a>
                )}
              </span>
              {a.dismissible && (
                <button
                  type="button"
                  onClick={() => dismissAnnouncement(a.id)}
                  aria-label="Dismiss announcement"
                  className="shrink-0 opacity-70 hover:opacity-100"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}

      {notifPermission === "default" && (
        <button
          type="button"
          onClick={handleEnableNotifications}
          className="shrink-0 border-b border-border bg-panel-raised px-4 py-2 text-left text-xs text-text-dim transition hover:text-accent-bright"
        >
          🔔 Enable notifications for new replies
        </button>
      )}

      <div className="flex items-center gap-2 overflow-x-auto border-b border-border px-4 py-3">
        {quickQuestions.map((q) => (
          <button
            key={q.id}
            type="button"
            onClick={() => sendMessage(q.message, q.id > 0 ? q.id : undefined)}
            className="shrink-0 rounded-full border border-accent/40 px-4 py-2 text-sm whitespace-nowrap text-accent-bright transition hover:border-accent hover:bg-accent/10 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none active:scale-[0.97]"
          >
            {q.icon} {q.label}
          </button>
        ))}
        {faqs.length > 0 && (
          <button
            type="button"
            onClick={() => setShowFaqs((v) => !v)}
            aria-expanded={showFaqs}
            className="shrink-0 rounded-full border border-border px-4 py-2 text-sm whitespace-nowrap text-text-dim transition hover:border-accent/40 hover:text-accent-bright"
          >
            ❓ FAQs
          </button>
        )}
      </div>

      {showFaqs && faqs.length > 0 && (
        <div className="max-h-48 shrink-0 space-y-2 overflow-y-auto border-b border-border bg-panel-raised/50 px-4 py-3">
          {faqs.map((faq) => (
            <details key={faq.id} className="rounded-lg bg-panel px-3 py-2 text-sm">
              <summary className="cursor-pointer font-medium text-foreground">{faq.question}</summary>
              <p className="mt-1.5 whitespace-pre-wrap text-text-dim">{faq.answer}</p>
            </details>
          ))}
        </div>
      )}

      <div className="relative flex-1 overflow-hidden">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full space-y-3 overflow-y-auto px-4 py-4"
        >
          <div className="flex justify-start">
            <div className="flex max-w-[80%] items-end gap-2">
              <JessicaAvatar size={24} imageUrl={appearance.avatarUrl ?? appearance.logoUrl} />
              <div className="rounded-2xl border border-border bg-panel-raised px-4 py-2.5 text-sm whitespace-pre-wrap text-foreground">
                👾 {appearance.welcomeMessage}
              </div>
            </div>
          </div>

          {messages.map((message, index) => {
            const showDateSeparator =
              index === 0 ||
              new Date(message.createdAt).toDateString() !==
                new Date(messages[index - 1].createdAt).toDateString();
            const { quote, body } = parseQuote(message.text);

            return (
              <div key={message.id} className="message-in">
                {showDateSeparator && (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-full bg-panel-raised px-3 py-1 text-[10px] text-text-faint">
                      {formatDateSeparator(message.createdAt)}
                    </span>
                  </div>
                )}

                {message.imageUrl ? (
                  <div
                    className={`flex items-end gap-2 ${message.sender === "user" ? "flex-row-reverse" : ""}`}
                  >
                    {message.sender === "agent" && (
                      <JessicaAvatar size={24} imageUrl={appearance.avatarUrl ?? appearance.logoUrl} />
                    )}
                    <div className="flex flex-col">
                      {message.sender === "agent" && (
                        <p className="mb-0.5 text-[10px] tracking-wide text-accent-bright uppercase">
                          {appearance.supportName}
                        </p>
                      )}
                      <a href={message.imageUrl} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded, arbitrary dimensions */}
                        <img
                          src={message.imageUrl}
                          alt="Shared attachment"
                          className="h-auto w-[220px] rounded-lg bg-border object-cover"
                        />
                      </a>
                      <p className="mt-1 flex items-center gap-1 text-[10px] text-text-faint">
                        {formatTime(message.createdAt)}
                        {message.sender === "user" && (
                          <MessageTicks deliveredAt={message.deliveredAt} readAt={message.readAt} />
                        )}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`group flex items-end gap-2 ${message.sender === "user" ? "flex-row-reverse" : ""}`}
                  >
                    {message.sender === "agent" && (
                      <JessicaAvatar size={24} imageUrl={appearance.avatarUrl ?? appearance.logoUrl} />
                    )}
                    <div className="flex max-w-[80%] flex-col">
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-sm ${
                          message.sender === "user"
                            ? message.failed
                              ? "border-2 border-red-400 bg-accent/60 text-white"
                              : "bg-accent text-white"
                            : "border border-border bg-panel-raised text-foreground"
                        } ${message.pending ? "opacity-70" : ""}`}
                      >
                        {message.sender === "agent" && (
                          <p className="mb-0.5 text-[10px] tracking-wide text-accent-bright uppercase">
                            Jessica
                          </p>
                        )}
                        {quote && (
                          <p
                            className={`mb-1 border-l-2 pl-2 text-xs italic ${
                              message.sender === "user"
                                ? "border-white/40 text-white/70"
                                : "border-accent/40 text-text-dim"
                            }`}
                          >
                            {quote}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap">{body}</p>
                        <p
                          className={`mt-1 flex items-center gap-1 text-[10px] ${
                            message.sender === "user" ? "text-white/60" : "text-text-faint"
                          }`}
                        >
                          {message.pending ? (
                            "Sending…"
                          ) : (
                            <>
                              {formatTime(message.createdAt)}
                              {message.sender === "user" && (
                                <MessageTicks
                                  deliveredAt={message.deliveredAt}
                                  readAt={message.readAt}
                                />
                              )}
                            </>
                          )}
                        </p>
                      </div>

                      {message.failed ? (
                        <button
                          type="button"
                          onClick={() => retryMessage(message)}
                          className="mt-1 self-end text-[10px] text-red-500 underline underline-offset-2"
                        >
                          Failed to send — tap to retry
                        </button>
                      ) : (
                        <div
                          className={`mt-1 flex gap-2 opacity-0 transition group-hover:opacity-100 ${
                            message.sender === "user" ? "self-end" : "self-start"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => copyMessage(message)}
                            aria-label="Copy message"
                            title="Copy"
                            className="text-[10px] text-text-faint hover:text-accent-bright focus-visible:opacity-100 focus-visible:outline-none"
                          >
                            {copiedId === message.id ? "Copied!" : "Copy"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingTo(message);
                              textareaRef.current?.focus();
                            }}
                            aria-label="Reply to this message"
                            title="Reply"
                            className="text-[10px] text-text-faint hover:text-accent-bright focus-visible:opacity-100 focus-visible:outline-none"
                          >
                            Reply
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {peerTyping && (
            <div className="flex items-end gap-2">
              <JessicaAvatar size={24} imageUrl={appearance.avatarUrl ?? appearance.logoUrl} />
              <TypingDots />
            </div>
          )}
        </div>

        {newMessageCount > 0 && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-white shadow-lg transition hover:bg-accent-bright"
          >
            {newMessageCount} new message{newMessageCount > 1 ? "s" : ""} ↓
          </button>
        )}
        {newMessageCount === 0 && showScrollButton && (
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label="Scroll to bottom"
            title="Scroll to bottom"
            className="absolute right-3 bottom-3 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-panel text-text-dim shadow-lg transition hover:text-accent-bright focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            ↓
          </button>
        )}
      </div>

      {replyingTo && (
        <div className="flex items-center justify-between border-t border-border bg-panel-raised px-4 py-2 text-xs text-text-dim">
          <span className="truncate">
            Replying to: <span className="italic">{parseQuote(replyingTo.text).body.slice(0, 60)}</span>
          </span>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            aria-label="Cancel reply"
            className="ml-2 shrink-0 text-text-faint hover:text-accent-bright"
          >
            ✕
          </button>
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          sendMessage(draft);
        }}
        className="flex items-end gap-2 border-t border-border px-3 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
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
          aria-label="Attach an image"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-lg text-text-dim transition hover:border-accent/40 hover:text-accent-bright focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none active:scale-95 disabled:opacity-50"
        >
          {uploading ? "…" : "📷"}
        </button>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(event) => handleDraftChange(event.target.value)}
          onKeyDown={handleComposerKeyDown}
          placeholder={`Message ${appearance.supportName}…`}
          rows={1}
          aria-label={`Message ${appearance.supportName}`}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-2.5 text-base text-foreground placeholder:text-text-faint focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none focus:border-accent/50"
        />
        <button
          type="submit"
          aria-label="Send message"
          className="h-11 shrink-0 rounded-full bg-accent px-5 text-base text-white transition hover:bg-accent-bright focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none active:scale-95 disabled:opacity-40"
          disabled={!draft.trim() || !visitorId}
        >
          Send
        </button>
      </form>
    </div>
  );
}
