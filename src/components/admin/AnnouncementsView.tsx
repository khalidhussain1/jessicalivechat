"use client";

import { useEffect, useState } from "react";

type AnnouncementType = "info" | "success" | "warning" | "important";
type Announcement = {
  id: number;
  text: string;
  type: AnnouncementType;
  enabled: boolean;
  dismissible: boolean;
  linkLabel: string | null;
  linkUrl: string | null;
};

const TYPE_OPTIONS: { key: AnnouncementType; label: string }[] = [
  { key: "info", label: "ℹ️ Info" },
  { key: "success", label: "✅ Success" },
  { key: "warning", label: "⚠️ Warning" },
  { key: "important", label: "📢 Important" },
];

export function AnnouncementsView() {
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [text, setText] = useState("");
  const [type, setType] = useState<AnnouncementType>("info");
  const [dismissible, setDismissible] = useState(true);

  async function load() {
    const res = await fetch("/api/admin/announcements");
    if (res.ok) {
      const data: { announcements: Announcement[] } = await res.json();
      setItems(data.announcements);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load; load() is reused by mutation handlers below
    load();
  }, []);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    await fetch("/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, type, dismissible }),
    });
    setText("");
    setType("info");
    setDismissible(true);
    setShowAdd(false);
    load();
  }

  async function toggleEnabled(item: Announcement) {
    await fetch(`/api/admin/announcements/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !item.enabled }),
    });
    load();
  }

  async function remove(id: number) {
    if (!window.confirm("Delete this announcement? This cannot be undone.")) return;
    await fetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
    load();
  }

  if (!items) {
    return <div className="px-4 py-10 text-center text-sm text-text-dim">Loading announcements…</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-text-dim">{items.length} announcement{items.length === 1 ? "" : "s"}</p>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="rounded-full bg-accent px-4 py-2 text-xs text-white transition hover:bg-accent-bright"
        >
          {showAdd ? "Cancel" : "+ New announcement"}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="mb-4 space-y-2 rounded-2xl border border-border bg-panel p-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. 🎉 New games are now available!"
            rows={2}
            maxLength={500}
            className="w-full resize-none rounded-2xl border border-border bg-background px-3.5 py-2 text-sm"
            required
          />
          <div className="flex flex-wrap items-center gap-2">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setType(opt.key)}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  type === opt.key ? "border-accent bg-accent/10 text-accent-bright" : "border-border text-text-dim"
                }`}
              >
                {opt.label}
              </button>
            ))}
            <label className="ml-2 flex items-center gap-1.5 text-xs text-text-dim">
              <input type="checkbox" checked={dismissible} onChange={(e) => setDismissible(e.target.checked)} />
              Customer can dismiss
            </label>
          </div>
          <button type="submit" className="rounded-full bg-accent px-4 py-2 text-xs text-white hover:bg-accent-bright">
            Create
          </button>
        </form>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-panel p-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2 text-[10px] text-text-faint">
                <span>{TYPE_OPTIONS.find((o) => o.key === item.type)?.label}</span>
                {!item.enabled && <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-red-600">Disabled</span>}
              </div>
              <p className="text-sm text-foreground">{item.text}</p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                onClick={() => toggleEnabled(item)}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-text-dim hover:border-accent/40 hover:text-accent-bright"
              >
                {item.enabled ? "Disable" : "Enable"}
              </button>
              <button
                type="button"
                onClick={() => remove(item.id)}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-text-dim hover:border-red-500/40 hover:text-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
