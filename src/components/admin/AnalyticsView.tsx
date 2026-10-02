"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/format";

type DashboardStats = {
  total: number;
  open: number;
  resolved: number;
  messagesToday: number;
  messagesThisWeek: number;
  avgResponseTimeMs: number | null;
};

type AnalyticsStats = {
  conversationsToday: number;
  conversationsThisWeek: number;
  mostCommonQuickQuestions: { label: string; count: number }[];
  mostActiveHours: { hour: number; count: number }[];
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-panel p-4">
      <p className="text-xs text-text-dim">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function AnalyticsView() {
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsStats | null>(null);

  useEffect(() => {
    fetch("/api/admin/dashboard").then((res) => res.json()).then(setDashboard).catch(() => {});
    fetch("/api/admin/analytics").then((res) => res.json()).then(setAnalytics).catch(() => {});
  }, []);

  if (!dashboard || !analytics) {
    return <div className="px-4 py-10 text-center text-sm text-text-dim">Loading analytics…</div>;
  }

  const maxHourCount = Math.max(...analytics.mostActiveHours.map((h) => h.count), 1);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Conversations today" value={analytics.conversationsToday} />
        <StatCard label="Conversations this week" value={analytics.conversationsThisWeek} />
        <StatCard label="Messages today" value={dashboard.messagesToday} />
        <StatCard label="Messages this week" value={dashboard.messagesThisWeek} />
        <StatCard label="Open conversations" value={dashboard.open} />
        <StatCard label="Resolved conversations" value={dashboard.resolved} />
        <StatCard
          label="Avg. response time"
          value={dashboard.avgResponseTimeMs != null ? formatDuration(dashboard.avgResponseTimeMs) : "—"}
        />
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-panel p-4">
        <p className="mb-3 text-xs font-medium text-text-dim">Most common quick question</p>
        {analytics.mostCommonQuickQuestions.length === 0 ? (
          <p className="text-sm text-text-faint">Not enough data yet.</p>
        ) : (
          <div className="space-y-2">
            {analytics.mostCommonQuickQuestions.map((q) => (
              <div key={q.label} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{q.label}</span>
                <span className="text-text-dim">{q.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-panel p-4">
        <p className="mb-3 text-xs font-medium text-text-dim">Most active hours (last 30 days, server time)</p>
        {analytics.mostActiveHours.length === 0 ? (
          <p className="text-sm text-text-faint">Not enough data yet.</p>
        ) : (
          <div className="flex h-24 items-end gap-0.5">
            {Array.from({ length: 24 }, (_, hour) => {
              const entry = analytics.mostActiveHours.find((h) => h.hour === hour);
              const pct = entry ? Math.max(4, Math.round((entry.count / maxHourCount) * 100)) : 2;
              return (
                <div key={hour} className="flex flex-1 flex-col items-center gap-1" title={`${hour}:00 — ${entry?.count ?? 0} messages`}>
                  <div className="flex w-full flex-1 items-end">
                    <div className="w-full rounded-t bg-accent" style={{ height: `${pct}%` }} />
                  </div>
                  {hour % 4 === 0 && <span className="text-[8px] text-text-faint">{hour}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
