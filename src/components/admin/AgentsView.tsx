"use client";

import { useEffect, useState } from "react";
import { initialsFor } from "@/lib/format";
import { hasRole, roleLabel, type AgentInfo, type AgentRole } from "@/components/admin/types";

type AgentRow = {
  id: string;
  name: string;
  username: string;
  role: AgentRole;
  isActive: boolean;
  createdAt: number;
  online: boolean;
};

const POLL_INTERVAL_MS = 10000;

export function AgentsView({ currentAgent }: { currentAgent: AgentInfo }) {
  const [agents, setAgents] = useState<AgentRow[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AgentRole>("agent");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canManage = hasRole(currentAgent, "super_admin");

  async function load() {
    try {
      const res = await fetch("/api/admin/agents");
      if (!res.ok) return;
      const data: { agents: AgentRow[] } = await res.json();
      setAgents(data.agents);
    } catch {
      // ignore transient network errors; next poll retries
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial poll; load() is reused by mutation handlers below, so it can't be nested inside this effect
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username, password, role }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Could not create agent");
      return;
    }
    setName("");
    setUsername("");
    setPassword("");
    setRole("agent");
    setShowAdd(false);
    load();
  }

  async function updateAgent(id: string, patch: { role?: AgentRole; isActive?: boolean }) {
    setBusyId(id);
    await fetch(`/api/admin/agents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => {});
    await load();
    setBusyId(null);
  }

  if (!agents) {
    return <div className="px-4 py-10 text-center text-sm text-text-dim">Loading agents…</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-text-dim">{agents.length} agent{agents.length === 1 ? "" : "s"}</p>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="rounded-full bg-accent px-4 py-2 text-xs text-white transition hover:bg-accent-bright"
          >
            {showAdd ? "Cancel" : "+ Add agent"}
          </button>
        )}
      </div>

      {showAdd && canManage && (
        <form onSubmit={handleAdd} className="mb-4 space-y-2 rounded-2xl border border-border bg-panel p-4">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              aria-label="Full name"
              className="rounded-full border border-border bg-background px-3.5 py-2 text-sm"
              required
            />
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              aria-label="Username"
              className="rounded-full border border-border bg-background px-3.5 py-2 text-sm"
              required
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 6 chars)"
              type="password"
              aria-label="Password"
              className="rounded-full border border-border bg-background px-3.5 py-2 text-sm"
              required
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AgentRole)}
              aria-label="Role"
              className="rounded-full border border-border bg-background px-3.5 py-2 text-sm"
            >
              <option value="agent">Agent</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
          <button type="submit" className="rounded-full bg-accent px-4 py-2 text-xs text-white hover:bg-accent-bright">
            Create agent
          </button>
        </form>
      )}

      <div className="space-y-2">
        {agents.map((a) => (
          <div
            key={a.id}
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-panel p-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-white">
              {initialsFor(a.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-foreground">{a.name}</p>
                <span className={`h-2 w-2 rounded-full ${a.online ? "bg-accent" : "bg-border"}`} aria-hidden="true" />
                {!a.isActive && (
                  <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] text-red-600">Disabled</span>
                )}
              </div>
              <p className="truncate text-xs text-text-dim">@{a.username} · {roleLabel(a.role)}</p>
            </div>
            {canManage && a.id !== currentAgent.id && (
              <div className="flex shrink-0 items-center gap-2">
                <select
                  value={a.role}
                  disabled={busyId === a.id}
                  onChange={(e) => updateAgent(a.id, { role: e.target.value as AgentRole })}
                  aria-label={`Role for ${a.name}`}
                  className="rounded-full border border-border bg-background px-2.5 py-1.5 text-xs"
                >
                  <option value="agent">Agent</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
                <button
                  type="button"
                  disabled={busyId === a.id}
                  onClick={() => updateAgent(a.id, { isActive: !a.isActive })}
                  className="rounded-full border border-border px-3 py-1.5 text-xs text-text-dim transition hover:border-accent/40 hover:text-accent-bright disabled:opacity-50"
                >
                  {a.isActive ? "Disable" : "Enable"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
