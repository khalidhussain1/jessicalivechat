"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";

type AuditEntry = {
  id: number;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  target: string | null;
  createdAt: number;
};

const ACTION_LABELS: Record<string, string> = {
  "settings.update": "updated settings",
  "settings.reset": "reset settings to default",
  "agent.create": "created agent",
  "agent.role_change": "changed an agent's role",
  "agent.enable": "enabled an agent",
  "agent.disable": "disabled an agent",
};

export function AuditLogView() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);

  useEffect(() => {
    fetch("/api/admin/audit-log")
      .then((res) => res.json())
      .then((data: { entries: AuditEntry[] }) => setEntries(data.entries))
      .catch(() => setEntries([]));
  }, []);

  if (!entries) {
    return <div className="px-4 py-10 text-center text-sm text-text-dim">Loading audit log…</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      {entries.length === 0 && <p className="text-sm text-text-dim">No management actions recorded yet.</p>}
      <div className="space-y-2">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-panel px-4 py-2.5 text-sm">
            <p className="text-foreground">
              <span className="font-medium">{entry.actorName ?? "Unknown"}</span>{" "}
              <span className="text-text-dim">{ACTION_LABELS[entry.action] ?? entry.action}</span>
              {entry.target && <span className="text-text-faint"> ({entry.target})</span>}
            </p>
            <p className="shrink-0 text-xs text-text-faint">{formatDateTime(entry.createdAt)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
