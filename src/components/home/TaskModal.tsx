"use client";

import { useRef, useState } from "react";

type Task = { id: number; title: string; description: string; instructions: string; rewardLabel: string };

export function TaskModal({
  task,
  visitorId,
  onClose,
  onSubmitted,
}: {
  task: Task;
  visitorId: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [proofText, setProofText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!proofText.trim() && !file) {
      setError("Please add a note or a screenshot as proof.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const formData = new FormData();
    formData.append("visitorId", visitorId);
    formData.append("proofText", proofText);
    if (file) formData.append("file", file);

    try {
      const res = await fetch(`/api/tasks/${task.id}/submit`, { method: "POST", body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not submit — please try again.");
      } else {
        setDone(true);
        onSubmitted();
      }
    } catch {
      setError("Could not submit — please try again.");
    }
    setSubmitting(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={task.title}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-3xl border border-border bg-panel p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">{task.title}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-text-faint hover:bg-panel-raised">✕</button>
        </div>

        {done ? (
          <p className="text-sm text-accent-bright">✅ Submitted! An agent will review your proof shortly.</p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <p className="text-xs text-text-dim">{task.instructions || task.description}</p>
            <p className="text-xs font-medium text-amber-600">🎁 Reward: {task.rewardLabel}</p>
            <textarea
              value={proofText}
              onChange={(e) => setProofText(e.target.value)}
              placeholder="Describe what you did, or paste a link…"
              rows={3}
              className="w-full resize-none rounded-2xl border border-border bg-background px-3.5 py-2 text-sm"
            />
            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-full border border-border px-3 py-1.5 text-xs text-text-dim hover:border-accent/40">
                {file ? "📷 Screenshot attached" : "📷 Attach screenshot"}
              </button>
              {file && <button type="button" onClick={() => setFile(null)} className="text-xs text-text-faint hover:text-red-500">Remove</button>}
            </div>
            {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
            <button type="submit" disabled={submitting} className="w-full rounded-full bg-accent px-4 py-2 text-sm text-white hover:bg-accent-bright disabled:opacity-50">
              {submitting ? "Submitting…" : "Submit Proof"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
