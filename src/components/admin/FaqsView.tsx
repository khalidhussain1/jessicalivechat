"use client";

import { useEffect, useState } from "react";

type Faq = { id: number; question: string; answer: string; enabled: boolean; sortOrder: number };

export function FaqsView() {
  const [items, setItems] = useState<Faq[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  async function load() {
    const res = await fetch("/api/admin/faqs");
    if (res.ok) {
      const data: { faqs: Faq[] } = await res.json();
      setItems(data.faqs);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load; load() is reused by mutation handlers below
    load();
  }, []);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    await fetch("/api/admin/faqs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, answer }),
    });
    setQuestion("");
    setAnswer("");
    setShowAdd(false);
    load();
  }

  async function patch(id: number, body: Record<string, unknown>) {
    await fetch(`/api/admin/faqs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  async function remove(id: number) {
    if (!window.confirm("Delete this FAQ?")) return;
    await fetch(`/api/admin/faqs/${id}`, { method: "DELETE" });
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
    return <div className="px-4 py-10 text-center text-sm text-text-dim">Loading FAQs…</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-text-dim">{items.length} FAQ{items.length === 1 ? "" : "s"}</p>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="rounded-full bg-accent px-4 py-2 text-xs text-white transition hover:bg-accent-bright"
        >
          {showAdd ? "Cancel" : "+ Add FAQ"}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="mb-4 space-y-2 rounded-2xl border border-border bg-panel p-4">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Question"
            className="w-full rounded-full border border-border bg-background px-3.5 py-2 text-sm"
            required
          />
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Answer"
            rows={3}
            className="w-full resize-none rounded-2xl border border-border bg-background px-3.5 py-2 text-sm"
            required
          />
          <button type="submit" className="rounded-full bg-accent px-4 py-2 text-xs text-white hover:bg-accent-bright">Create</button>
        </form>
      )}

      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-border bg-panel p-3">
            <div className="flex shrink-0 flex-col pt-1">
              <button type="button" disabled={index === 0} onClick={() => move(index, -1)} className="text-text-faint hover:text-accent-bright disabled:opacity-30">▲</button>
              <button type="button" disabled={index === items.length - 1} onClick={() => move(index, 1)} className="text-text-faint hover:text-accent-bright disabled:opacity-30">▼</button>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{item.question}</p>
              <p className="mt-0.5 text-xs text-text-dim">{item.answer}</p>
              {!item.enabled && <span className="mt-1 inline-block rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] text-red-600">Disabled</span>}
            </div>
            <div className="flex shrink-0 flex-col gap-1.5">
              <button
                type="button"
                onClick={() => patch(item.id, { enabled: !item.enabled })}
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
