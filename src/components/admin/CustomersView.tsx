"use client";

import { useEffect, useState } from "react";
import { StatusDot } from "@/components/StatusDot";
import { formatDateTime, formatRelativeTime, initialsFor } from "@/lib/format";
import type { Conversation } from "@/components/admin/types";

type BlockedCustomer = { visitorId: string; reason: string | null; blockedAt: number };

export function CustomersView({ conversations }: { conversations: Conversation[] }) {
  const [search, setSearch] = useState("");
  const [blocked, setBlocked] = useState<BlockedCustomer[] | null>(null);

  async function loadBlocked() {
    const res = await fetch("/api/admin/blocked");
    if (res.ok) {
      const data: { blocked: BlockedCustomer[] } = await res.json();
      setBlocked(data.blocked);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load; loadBlocked() is reused by block/unblock handlers below
    loadBlocked();
  }, []);

  async function block(visitorId: string) {
    const reason = window.prompt("Reason for blocking this customer (optional):") ?? "";
    await fetch("/api/admin/blocked", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, reason: reason || null }),
    });
    loadBlocked();
  }

  async function unblock(visitorId: string) {
    await fetch(`/api/admin/blocked/${visitorId}`, { method: "DELETE" });
    loadBlocked();
  }

  if (blocked === null) {
    return <div className="px-4 py-10 text-center text-sm text-text-dim">Loading customers…</div>;
  }

  const blockedIds = new Set(blocked.map((b) => b.visitorId));
  const filtered = conversations.filter((c) =>
    !search.trim() || (c.visitorName ?? c.visitorId).toLowerCase().includes(search.toLowerCase()) || (c.visitorEmail ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-panel p-4 md:rounded-2xl md:border md:border-border md:p-6 md:shadow-lg md:shadow-black/10">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search customers…"
        aria-label="Search customers"
        className="mb-4 w-full rounded-full border border-border bg-background px-3.5 py-2.5 text-sm"
      />

      <div className="space-y-2">
        {filtered.map((c) => {
          const isBlocked = blockedIds.has(c.visitorId);
          return (
            <div key={c.visitorId} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-panel p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-border text-[11px] font-medium text-text-dim">
                {initialsFor(c.visitorName ?? c.visitorId)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{c.visitorName ?? "Guest"}</p>
                  {isBlocked && <span className="shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] text-red-600">Blocked</span>}
                </div>
                <div className="flex items-center gap-2 text-xs text-text-dim">
                  <StatusDot online={c.visitorOnline} />
                  <span>· last active {formatRelativeTime(c.lastMessageAt)}</span>
                </div>
                {c.visitorEmail && <p className="truncate text-xs text-text-faint">{c.visitorEmail}</p>}
              </div>
              <p className="shrink-0 text-[11px] text-text-faint">Since {formatDateTime(c.createdAt)}</p>
              <button
                type="button"
                onClick={() => (isBlocked ? unblock(c.visitorId) : block(c.visitorId))}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition ${
                  isBlocked ? "border-border text-text-dim hover:border-accent/40" : "border-red-500/30 text-red-600 hover:bg-red-500/10"
                }`}
              >
                {isBlocked ? "Unblock" : "Block"}
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="px-2 py-6 text-sm text-text-faint">No customers yet.</p>}
      </div>
    </div>
  );
}
