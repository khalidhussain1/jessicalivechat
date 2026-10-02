"use client";

import { useEffect, useState } from "react";

type CannedReply = { id: number; category: string; text: string };

export function CannedRepliesView() {
  const [items, setItems] = useState<CannedReply[] | null>(null);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [category, setCategory] = useState("General");
  const [text, setText] = useState("");

  async function load() {
    const res = await fetch("/api/admin/canned-replies");
    if (res.ok) {
      const data: { cannedReplies: CannedReply[] } = await res.json();
      setItems(data.cannedReplies);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load; load() is reused by mutation handlers below
    load();
  }, []);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    await fetch("/api/admin/canned-replies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: category || "General", text }),
    });
    setCategory("General");
    setText("");
    setShowAdd(false);
    load();
  }

  async function remove(id: number) {
    if (!window.confirm("Delete this canned reply?")) return;
    await fetch(`/api/admin/canned-replies/${id}`, { method: "DELETE" });
    load();
  }

  if (!items) {
    return <div className="px-4 py-10 text-center text-sm text-text-dim">Loading canned replies…</div>;
  }

  const filtered = items.filter(
    (i) => !search.trim() || i.text.toLowerCase().includes(search.toLowerCase()) || i.category.toLowerCase().includes(search.toLowerCase()),
  );
  const byCategory = new Map<string, CannedReply[]>();
  for (const item of filtered) {
    const list = byCategory.get(item.category) ?? [];
    list.push(item);
    byCategory.set(item.category, list);
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-panel p-4 md:rounded-2xl md:border md:border-border md:p-6 md:shadow-lg md:shadow-black/10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search canned replies…"
          aria-label="Search canned replies"
          className="min-w-0 flex-1 rounded-full border border-border bg-background px-3.5 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="shrink-0 rounded-full bg-accent px-4 py-2 text-xs text-white transition hover:bg-accent-bright"
        >
          {showAdd ? "Cancel" : "+ Add reply"}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="mb-4 space-y-2 rounded-2xl border border-border bg-panel p-4">
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category (e.g. Greetings, Billing)"
            className="w-full rounded-full border border-border bg-background px-3.5 py-2 text-sm"
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Reply text"
            rows={2}
            className="w-full resize-none rounded-2xl border border-border bg-background px-3.5 py-2 text-sm"
            required
          />
          <button type="submit" className="rounded-full bg-accent px-4 py-2 text-xs text-white hover:bg-accent-bright">Create</button>
        </form>
      )}

      {[...byCategory.entries()].map(([cat, replies]) => (
        <div key={cat} className="mb-4">
          <p className="mb-1.5 text-xs font-medium text-text-dim">{cat}</p>
          <div className="space-y-1.5">
            {replies.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-panel px-3.5 py-2 text-sm">
                <p className="min-w-0 flex-1 truncate text-foreground">{item.text}</p>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="shrink-0 text-xs text-text-faint hover:text-red-500"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
