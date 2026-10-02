"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/format";

type DashboardStats = {
  total: number;
  open: number;
  pending: number;
  resolved: number;
  unreadConversations: number;
  unreadMessages: number;
  onlineCustomers: number;
  offlineCustomers: number;
  activeRings: number;
  messagesToday: number;
  messagesThisWeek: number;
  avgResponseTimeMs: number | null;
};

const POLL_INTERVAL_MS = 5000;

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: "amber" | "accent" }) {
  return (
    <div className="rounded-2xl border border-border bg-panel p-4">
      <p className="text-xs text-text-dim">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold ${
          tone === "amber" ? "text-amber-600" : tone === "accent" ? "text-accent-bright" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StatusBar({ label, value, max, className }: { label: string; value: number; max: number; className: string }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 4;
  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      <div className="flex h-32 w-full items-end rounded-lg bg-panel-raised">
        <div className={`w-full rounded-lg ${className}`} style={{ height: `${pct}%` }} />
      </div>
      <p className="text-xs text-text-dim">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

export function DashboardView() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/admin/dashboard");
        if (!res.ok) return;
        const data: DashboardStats = await res.json();
        if (!cancelled) setStats(data);
      } catch {
        // ignore transient network errors; next poll retries
      }
    }
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!stats) {
    return <div className="px-4 py-10 text-center text-sm text-text-dim">Loading dashboard…</div>;
  }

  const statusMax = Math.max(stats.open, stats.pending, stats.resolved, 1);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-panel p-4 md:rounded-2xl md:border md:border-border md:p-6 md:shadow-lg md:shadow-black/10">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total conversations" value={stats.total} />
        <StatCard label="Unread conversations" value={stats.unreadConversations} tone={stats.unreadConversations > 0 ? "accent" : undefined} />
        <StatCard label="Unread messages" value={stats.unreadMessages} tone={stats.unreadMessages > 0 ? "accent" : undefined} />
        <StatCard label="Ring requests" value={stats.activeRings} tone={stats.activeRings > 0 ? "amber" : undefined} />
        <StatCard label="Online customers" value={stats.onlineCustomers} />
        <StatCard label="Offline customers" value={stats.offlineCustomers} />
        <StatCard label="Messages today" value={stats.messagesToday} />
        <StatCard label="Messages this week" value={stats.messagesThisWeek} />
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-panel p-4">
        <p className="mb-1 text-xs text-text-dim">Average response time (last 30 days)</p>
        <p className="text-2xl font-semibold text-foreground">
          {stats.avgResponseTimeMs != null ? formatDuration(stats.avgResponseTimeMs) : "Not enough data yet"}
        </p>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-panel p-4">
        <p className="mb-4 text-xs text-text-dim">Conversations by status</p>
        <div className="flex gap-4">
          <StatusBar label="Open" value={stats.open} max={statusMax} className="bg-accent" />
          <StatusBar label="Pending" value={stats.pending} max={statusMax} className="bg-amber-500" />
          <StatusBar label="Resolved" value={stats.resolved} max={statusMax} className="bg-border" />
        </div>
      </div>
    </div>
  );
}
