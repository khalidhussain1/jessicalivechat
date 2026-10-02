"use client";

import { useEffect, useRef, useState } from "react";
import { useNotificationSound, isSoundMuted, setSoundMuted } from "@/lib/use-notification-sound";
import { InboxView } from "@/components/admin/InboxView";
import { DashboardView } from "@/components/admin/DashboardView";
import { AgentsView } from "@/components/admin/AgentsView";
import { SettingsView } from "@/components/admin/SettingsView";
import { AuditLogView } from "@/components/admin/AuditLogView";
import { AnnouncementsView } from "@/components/admin/AnnouncementsView";
import { QuickQuestionsView } from "@/components/admin/QuickQuestionsView";
import { FaqsView } from "@/components/admin/FaqsView";
import { CannedRepliesView } from "@/components/admin/CannedRepliesView";
import { CustomersView } from "@/components/admin/CustomersView";
import { AnalyticsView } from "@/components/admin/AnalyticsView";
import { GamesView } from "@/components/admin/GamesView";
import { TasksView } from "@/components/admin/TasksView";
import { LuckyDrawView } from "@/components/admin/LuckyDrawView";
import { hasRole, roleLabel, type AgentInfo, type Conversation, type ConversationStatus } from "@/components/admin/types";

const POLL_INTERVAL_MS = 2000;
const CONTINUOUS_RING_INTERVAL_MS = 2500;

type View =
  | "dashboard"
  | "inbox"
  | "customers"
  | "announcements"
  | "games"
  | "tasks"
  | "lucky_draw"
  | "quick_questions"
  | "faqs"
  | "canned_replies"
  | "agents"
  | "settings"
  | "analytics"
  | "audit";

type NavItem = { key: View; label: string; minRole?: "admin" | "super_admin" };

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Workspace",
    items: [
      { key: "dashboard", label: "Dashboard" },
      { key: "inbox", label: "Inbox" },
      { key: "customers", label: "Customers", minRole: "admin" },
    ],
  },
  {
    label: "Content",
    items: [
      { key: "announcements", label: "Announcements", minRole: "admin" },
      { key: "games", label: "Games & Entertainment", minRole: "admin" },
      { key: "tasks", label: "Tasks & Rewards" },
      { key: "lucky_draw", label: "Lucky Draw", minRole: "admin" },
      { key: "quick_questions", label: "Quick Questions", minRole: "admin" },
      { key: "faqs", label: "FAQs", minRole: "admin" },
      { key: "canned_replies", label: "Canned Replies", minRole: "admin" },
    ],
  },
  {
    label: "System",
    items: [
      { key: "agents", label: "Agents", minRole: "admin" },
      { key: "settings", label: "Settings", minRole: "admin" },
      { key: "analytics", label: "Analytics", minRole: "admin" },
      { key: "audit", label: "Audit Log", minRole: "admin" },
    ],
  },
];

const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function AdminShell({ agent, onLogout }: { agent: AgentInfo; onLogout: () => void }) {
  const [view, setView] = useState<View>("dashboard");
  const [navOpen, setNavOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedVisitorId, setSelectedVisitorId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  const selectedVisitorIdRef = useRef<string | null>(null);
  const prevLastMessageAtRef = useRef<Record<string, number>>({});
  const hasPolledConversationsOnceRef = useRef(false);
  const continuousRingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { play, playUrgent, unlock } = useNotificationSound();

  useEffect(() => {
    selectedVisitorIdRef.current = selectedVisitorId;
  }, [selectedVisitorId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable client-side
    setMuted(isSoundMuted());
  }, []);

  const anyRingActive = conversations.some((c) => c.ringActive);
  const ringingCount = conversations.filter((c) => c.ringActive).length;

  // continuous alarm while any conversation is ringing — a single repeating interval,
  // never stacked, stopped the instant the agent dismisses or nothing is ringing anymore
  useEffect(() => {
    if (anyRingActive && !continuousRingIntervalRef.current) {
      playUrgent();
      continuousRingIntervalRef.current = setInterval(playUrgent, CONTINUOUS_RING_INTERVAL_MS);
    } else if (!anyRingActive && continuousRingIntervalRef.current) {
      clearInterval(continuousRingIntervalRef.current);
      continuousRingIntervalRef.current = null;
    }
    return () => {
      if (continuousRingIntervalRef.current) {
        clearInterval(continuousRingIntervalRef.current);
        continuousRingIntervalRef.current = null;
      }
    };
  }, [anyRingActive, playUrgent]);

  // poll the conversation list continuously, regardless of which view is active —
  // this is what powers the global ring alarm and nav badges
  useEffect(() => {
    let cancelled = false;

    async function pollConversations() {
      try {
        const res = await fetch("/api/agent/conversations");
        if (res.status === 401) {
          if (!cancelled) onLogout();
          return;
        }
        const data: { conversations: Conversation[] } = await res.json();
        if (cancelled) return;

        let shouldPlay = false;
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
        }
        hasPolledConversationsOnceRef.current = true;
        if (shouldPlay) play();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onLogout/play are stable for the component's lifetime
  }, []);

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
  }

  async function dismissRing(visitorId?: string) {
    if (continuousRingIntervalRef.current) {
      clearInterval(continuousRingIntervalRef.current);
      continuousRingIntervalRef.current = null;
    }
    setConversations((prev) =>
      prev.map((c) => (!visitorId || c.visitorId === visitorId ? { ...c, ringActive: false } : c)),
    );
    await fetch("/api/agent/ring/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId }),
    }).catch(() => {});
  }

  async function setConversationStatus(visitorId: string, status: ConversationStatus) {
    setConversations((prev) => prev.map((c) => (c.visitorId === visitorId ? { ...c, status } : c)));
    await fetch("/api/agent/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, status }),
    }).catch(() => {});
  }

  function patchConversation(visitorId: string, patch: Partial<Conversation>) {
    setConversations((prev) => prev.map((c) => (c.visitorId === visitorId ? { ...c, ...patch } : c)));
  }

  async function handleLogout() {
    await fetch("/api/agent/logout", { method: "POST" });
    onLogout();
  }

  const unreadInboxCount = conversations.filter((c) => c.unread).length;
  const viewTitle = NAV_ITEMS.find((i) => i.key === view)?.label ?? "Dashboard";

  return (
    <div onClick={unlock} className="flex h-dvh w-full flex-col md:px-8 md:py-6">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 pt-[max(env(safe-area-inset-top),0.75rem)] md:mb-6 md:border-none md:px-0 md:pt-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setNavOpen((v) => !v)}
            aria-label="Toggle navigation"
            className="rounded-full p-1.5 text-text-dim hover:text-accent-bright md:hidden"
          >
            ☰
          </button>
          <div>
            <h1 className="text-lg font-medium text-foreground md:text-2xl">Jessica — {viewTitle}</h1>
            <p className="text-xs text-text-dim">
              Signed in as {agent.name} · {roleLabel(agent.role)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={toggleMute}
            title={muted ? "Unmute sound alerts" : "Mute sound alerts"}
            aria-label={muted ? "Unmute sound alerts" : "Mute sound alerts"}
            className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-text-dim transition hover:text-accent-bright focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            {muted ? "🔇" : "🔊"}
          </button>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-medium text-white"
            aria-hidden="true"
          >
            {agent.name.slice(0, 2).toUpperCase()}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-border px-4 py-2 text-xs text-text-dim transition hover:border-accent/40 hover:text-accent-bright focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            Sign out
          </button>
        </div>
      </div>

      {anyRingActive && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 md:rounded-2xl md:border md:border-amber-500/30 md:mb-4">
          <p className="text-sm font-medium text-amber-700">
            🔔 {ringingCount} customer{ringingCount > 1 ? "s" : ""} need{ringingCount > 1 ? "" : "s"}{" "}
            attention
          </p>
          <button
            type="button"
            onClick={() => dismissRing()}
            className="flex h-9 shrink-0 items-center rounded-full bg-amber-600 px-4 text-xs font-medium text-white transition hover:bg-amber-700 focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:outline-none"
          >
            STOP RING
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
        <nav
          className={`shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border bg-panel p-2 md:flex md:w-56 md:rounded-2xl md:border ${
            navOpen ? "absolute inset-x-0 top-[72px] z-10 flex max-h-[70vh] border-b" : "hidden"
          }`}
        >
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter((item) => !item.minRole || hasRole(agent, item.minRole));
            if (items.length === 0) return null;
            return (
              <div key={group.label} className="mb-1">
                <p className="px-3 pt-3 pb-1 text-[10px] font-semibold tracking-wide text-text-faint uppercase">
                  {group.label}
                </p>
                {items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setView(item.key);
                      setNavOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                      view === item.key ? "bg-accent text-white" : "text-text-dim hover:bg-panel-raised"
                    }`}
                  >
                    {item.label}
                    {item.key === "inbox" && unreadInboxCount > 0 && (
                      <span
                        className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${
                          view === item.key ? "bg-white/20 text-white" : "bg-accent text-white"
                        }`}
                      >
                        {unreadInboxCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>

        {view === "dashboard" && <DashboardView />}
        {view === "inbox" && (
          <InboxView
            agent={agent}
            conversations={conversations}
            selectedVisitorId={selectedVisitorId}
            setSelectedVisitorId={setSelectedVisitorId}
            dismissRing={dismissRing}
            setStatus={setConversationStatus}
            patchConversation={patchConversation}
            play={play}
            onUnauthorized={onLogout}
          />
        )}
        {view === "customers" && hasRole(agent, "admin") && <CustomersView conversations={conversations} />}
        {view === "announcements" && hasRole(agent, "admin") && <AnnouncementsView />}
        {view === "games" && hasRole(agent, "admin") && <GamesView />}
        {view === "tasks" && <TasksView canManageTasks={hasRole(agent, "admin")} />}
        {view === "lucky_draw" && hasRole(agent, "admin") && <LuckyDrawView canDrawWinner={hasRole(agent, "super_admin")} />}
        {view === "quick_questions" && hasRole(agent, "admin") && <QuickQuestionsView />}
        {view === "faqs" && hasRole(agent, "admin") && <FaqsView />}
        {view === "canned_replies" && hasRole(agent, "admin") && <CannedRepliesView />}
        {view === "agents" && hasRole(agent, "admin") && <AgentsView currentAgent={agent} />}
        {view === "settings" && hasRole(agent, "admin") && <SettingsView canManageMaintenance={hasRole(agent, "super_admin")} />}
        {view === "analytics" && hasRole(agent, "admin") && <AnalyticsView />}
        {view === "audit" && hasRole(agent, "admin") && <AuditLogView />}
      </div>
    </div>
  );
}
