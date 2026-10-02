"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";

type Draw = {
  id: number;
  title: string;
  description: string;
  rewardLabel: string;
  maxEntries: number | null;
  status: "open" | "closed" | "drawn";
  winnerVisitorId: string | null;
  drawnAt: number | null;
  entryCount: number;
};

export function LuckyDrawView({ canDrawWinner }: { canDrawWinner: boolean }) {
  const [draws, setDraws] = useState<Draw[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rewardLabel, setRewardLabel] = useState("");
  const [maxEntries, setMaxEntries] = useState("");

  function load() {
    fetch("/api/admin/draws").then((res) => res.json()).then((d: { draws: Draw[] }) => setDraws(d.draws));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !rewardLabel.trim()) return;
    await fetch("/api/admin/draws", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        rewardLabel,
        maxEntries: maxEntries ? Number(maxEntries) : null,
      }),
    });
    setTitle("");
    setDescription("");
    setRewardLabel("");
    setMaxEntries("");
    setShowAdd(false);
    load();
  }

  async function setStatus(id: number, status: "open" | "closed") {
    await fetch(`/api/admin/draws/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function drawNow(id: number) {
    if (!window.confirm("Draw a winner now? This cannot be undone — the draw will close permanently.")) return;
    const res = await fetch(`/api/admin/draws/${id}/draw-winner`, { method: "POST" });
    const data = await res.json().catch(() => null);
    if (!res.ok) window.alert(data?.error ?? "Could not draw a winner");
    load();
  }

  if (!draws) {
    return <div className="px-4 py-10 text-center text-sm text-text-dim">Loading draws…</div>;
  }

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-panel p-4 md:rounded-2xl md:border md:border-border md:p-6 md:shadow-lg md:shadow-black/10">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-dim">Free promotional draws — no entry fee, no wagering.</p>
        <button type="button" onClick={() => setShowAdd((v) => !v)} className="rounded-full bg-accent px-4 py-2 text-xs text-white hover:bg-accent-bright">
          {showAdd ? "Cancel" : "+ New draw"}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="grid grid-cols-1 gap-2 rounded-2xl border border-border bg-panel p-4 sm:grid-cols-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Draw title" className="rounded-full border border-border bg-background px-3 py-2 text-sm" required />
          <input value={rewardLabel} onChange={(e) => setRewardLabel(e.target.value)} placeholder="Reward (e.g. Free Play Bundle)" className="rounded-full border border-border bg-background px-3 py-2 text-sm" required />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description / entry rules" className="rounded-full border border-border bg-background px-3 py-2 text-sm sm:col-span-2" />
          <input value={maxEntries} onChange={(e) => setMaxEntries(e.target.value)} type="number" min={1} placeholder="Max entries (optional)" className="rounded-full border border-border bg-background px-3 py-2 text-sm" />
          <button type="submit" className="rounded-full bg-accent px-4 py-2 text-sm text-white hover:bg-accent-bright sm:col-span-2">Create draw</button>
        </form>
      )}

      <div className="space-y-2">
        {draws.length === 0 && <p className="text-sm text-text-faint">No draws yet.</p>}
        {draws.map((d) => (
          <div key={d.id} className="rounded-2xl border border-border bg-panel p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">{d.title}</p>
                <p className="text-xs text-text-dim">{d.description}</p>
                <p className="mt-1 text-xs text-amber-600">🎁 {d.rewardLabel}</p>
                <p className="mt-1 text-xs text-text-faint">
                  Entries: {d.entryCount}{d.maxEntries ? ` / ${d.maxEntries}` : ""} · Status: {d.status}
                </p>
                {d.status === "drawn" && (
                  <p className="mt-1 text-xs font-medium text-accent-bright">
                    Winner: {d.winnerVisitorId?.slice(0, 8)}… · {d.drawnAt && formatDateTime(d.drawnAt)}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-1.5">
                {d.status === "open" && (
                  <button type="button" onClick={() => setStatus(d.id, "closed")} className="rounded-full border border-border px-3 py-1.5 text-xs text-text-dim hover:border-accent/40">
                    Close entries
                  </button>
                )}
                {d.status === "closed" && (
                  <button type="button" onClick={() => setStatus(d.id, "open")} className="rounded-full border border-border px-3 py-1.5 text-xs text-text-dim hover:border-accent/40">
                    Reopen
                  </button>
                )}
                {d.status !== "drawn" && canDrawWinner && (
                  <button
                    type="button"
                    onClick={() => drawNow(d.id)}
                    disabled={d.entryCount === 0}
                    className="rounded-full bg-amber-600 px-3 py-1.5 text-xs text-white hover:bg-amber-700 disabled:opacity-40"
                  >
                    🎲 Draw Winner Now
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
