"use client";

import { useEffect, useState } from "react";

type QuickQuestion = {
  id: number;
  icon: string;
  label: string;
  message: string;
  enabled: boolean;
  sortOrder: number;
};

export function QuickQuestionsView() {
  const [items, setItems] = useState<QuickQuestion[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [icon, setIcon] = useState("💬");
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const res = await fetch("/api/admin/quick-questions");
    if (res.ok) {
      const data: { quickQuestions: QuickQuestion[] } = await res.json();
      setItems(data.quickQuestions);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load; load() is reused by mutation handlers below
    load();
  }, []);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!label.trim() || !message.trim()) return;
    await fetch("/api/admin/quick-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ icon, label, message }),
    });
    setIcon("💬");
    setLabel("");
    setMessage("");
    setShowAdd(false);
    load();
  }

  async function patch(id: number, body: Record<string, unknown>) {
    await fetch(`/api/admin/quick-questions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  async function remove(id: number) {
    if (!window.confirm("Delete this quick question?")) return;
    await fetch(`/api/admin/quick-questions/${id}`, { method: "DELETE" });
    load();
  }

  function move(index: number, direction: -1 | 1) {
    if (!items) return;
    const target = items[index + direction];
    if (!target) return;
    const current = items[index];
    patch(current.id, { sortOrder: target.sortOrder });
    patch(target.id, { sortOrder: current.sortOrder });
  }

  if (!items) {
    return <div className="px-4 py-10 text-center text-sm text-text-dim">Loading quick questions…</div>;
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-panel p-4 md:rounded-2xl md:border md:border-border md:p-6 md:shadow-lg md:shadow-black/10">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-text-dim">These appear as tappable buttons above the customer&apos;s message box.</p>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="shrink-0 rounded-full bg-accent px-4 py-2 text-xs text-white transition hover:bg-accent-bright"
        >
          {showAdd ? "Cancel" : "+ Add"}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="mb-4 grid grid-cols-1 gap-2 rounded-2xl border border-border bg-panel p-4 md:grid-cols-[80px_1fr_1fr_auto]">
          <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Icon" className="rounded-full border border-border bg-background px-3 py-2 text-sm" maxLength={4} />
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Button label" className="rounded-full border border-border bg-background px-3 py-2 text-sm" required />
          <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message sent when clicked" className="rounded-full border border-border bg-background px-3 py-2 text-sm" required />
          <button type="submit" className="rounded-full bg-accent px-4 py-2 text-xs text-white hover:bg-accent-bright">Create</button>
        </form>
      )}

      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-border bg-panel p-3">
            <div className="flex shrink-0 flex-col">
              <button type="button" disabled={index === 0} onClick={() => move(index, -1)} className="text-text-faint hover:text-accent-bright disabled:opacity-30">▲</button>
              <button type="button" disabled={index === items.length - 1} onClick={() => move(index, 1)} className="text-text-faint hover:text-accent-bright disabled:opacity-30">▼</button>
            </div>
            <span className="shrink-0 text-xl">{item.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
              <p className="truncate text-xs text-text-dim">sends: &quot;{item.message}&quot;</p>
            </div>
            {!item.enabled && <span className="shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] text-red-600">Disabled</span>}
            <button
              type="button"
              onClick={() => patch(item.id, { enabled: !item.enabled })}
              className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-text-dim hover:border-accent/40 hover:text-accent-bright"
            >
              {item.enabled ? "Disable" : "Enable"}
            </button>
            <button
              type="button"
              onClick={() => remove(item.id)}
              className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-text-dim hover:border-red-500/40 hover:text-red-500"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
