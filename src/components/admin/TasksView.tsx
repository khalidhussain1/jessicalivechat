"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";

type Task = {
  id: number;
  title: string;
  description: string;
  instructions: string;
  rewardLabel: string;
  repeatable: boolean;
  enabled: boolean;
  sortOrder: number;
};

type Submission = {
  id: number;
  visitorId: string;
  taskTitle?: string;
  proofText: string | null;
  proofImageUrl: string | null;
  status: "pending" | "approved" | "rejected";
  reviewedBy: string | null;
  createdAt: number;
};

const STATUS_TABS: { key: Submission["status"]; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

function TaskRow({ task, onPatch, onMove, isFirst, isLast, onDelete }: {
  task: Task;
  onPatch: (id: number, patch: Partial<Task>) => void;
  onMove: (direction: -1 | 1) => void;
  isFirst: boolean;
  isLast: boolean;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-panel p-3">
      <div className="flex shrink-0 flex-col">
        <button type="button" disabled={isFirst} onClick={() => onMove(-1)} className="text-text-faint hover:text-accent-bright disabled:opacity-30">▲</button>
        <button type="button" disabled={isLast} onClick={() => onMove(1)} className="text-text-faint hover:text-accent-bright disabled:opacity-30">▼</button>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <input value={task.title} onChange={(e) => onPatch(task.id, { title: e.target.value })} className="w-full rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium" />
        <input value={task.description} onChange={(e) => onPatch(task.id, { description: e.target.value })} className="w-full rounded-full border border-border bg-background px-3 py-1 text-xs text-text-dim" />
        <input value={task.instructions} onChange={(e) => onPatch(task.id, { instructions: e.target.value })} placeholder="Instructions shown to customer" className="w-full rounded-full border border-border bg-background px-3 py-1 text-xs" />
        <input value={task.rewardLabel} onChange={(e) => onPatch(task.id, { rewardLabel: e.target.value })} placeholder="Reward" className="w-full rounded-full border border-border bg-background px-3 py-1 text-xs" />
      </div>
      <div className="flex shrink-0 flex-col gap-1.5">
        <button
          type="button"
          onClick={() => onPatch(task.id, { enabled: !task.enabled })}
          className={`rounded-full border px-3 py-1.5 text-xs ${task.enabled ? "border-border text-text-dim" : "border-red-500/30 text-red-600"}`}
        >
          {task.enabled ? "Enabled" : "Disabled"}
        </button>
        <label className="flex items-center gap-1 text-[10px] text-text-dim">
          <input type="checkbox" checked={task.repeatable} onChange={(e) => onPatch(task.id, { repeatable: e.target.checked })} />
          Daily
        </label>
        <button type="button" onClick={() => onDelete(task.id)} className="text-[10px] text-text-faint hover:text-red-500">Delete</button>
      </div>
    </div>
  );
}

export function TasksView({ canManageTasks }: { canManageTasks: boolean }) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [rewardLabel, setRewardLabel] = useState("");
  const [statusTab, setStatusTab] = useState<Submission["status"]>("pending");
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);

  function loadTasks() {
    fetch("/api/admin/tasks").then((res) => res.json()).then((d: { tasks: Task[] }) => setTasks(d.tasks));
  }
  function loadSubmissions(status: Submission["status"]) {
    setSubmissions(null);
    fetch(`/api/admin/tasks/submissions?status=${status}`).then((res) => res.json()).then((d: { submissions: Submission[] }) => setSubmissions(d.submissions));
  }

  useEffect(() => {
    if (canManageTasks) loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- canManageTasks is stable for the component's lifetime
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadSubmissions resets to a loading state before fetching; runs on mount and on tab switch
    loadSubmissions(statusTab);
  }, [statusTab]);

  async function patchTask(id: number, patch: Partial<Task>) {
    setTasks((prev) => prev?.map((t) => (t.id === id ? { ...t, ...patch } : t)) ?? null);
    await fetch(`/api/admin/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  function moveTask(index: number, direction: -1 | 1) {
    if (!tasks) return;
    const target = tasks[index + direction];
    if (!target) return;
    const current = tasks[index];
    patchTask(current.id, { sortOrder: target.sortOrder });
    patchTask(target.id, { sortOrder: current.sortOrder });
  }

  async function deleteTask(id: number) {
    if (!window.confirm("Delete this task? This cannot be undone.")) return;
    await fetch(`/api/admin/tasks/${id}`, { method: "DELETE" });
    loadTasks();
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !rewardLabel.trim()) return;
    await fetch("/api/admin/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, rewardLabel, description: "", instructions: "" }),
    });
    setTitle("");
    setRewardLabel("");
    setShowAdd(false);
    loadTasks();
  }

  async function review(id: number, decision: "approved" | "rejected") {
    await fetch(`/api/admin/tasks/submissions/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    loadSubmissions(statusTab);
  }

  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto bg-panel p-4 md:rounded-2xl md:border md:border-border md:p-6 md:shadow-lg md:shadow-black/10">
      {canManageTasks && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-text-dim">Tasks</p>
            <button type="button" onClick={() => setShowAdd((v) => !v)} className="rounded-full bg-accent px-4 py-2 text-xs text-white hover:bg-accent-bright">
              {showAdd ? "Cancel" : "+ New task"}
            </button>
          </div>
          {showAdd && (
            <form onSubmit={handleAdd} className="mb-3 grid grid-cols-1 gap-2 rounded-2xl border border-border bg-panel p-4 sm:grid-cols-[1fr_1fr_auto]">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" className="rounded-full border border-border bg-background px-3 py-2 text-sm" required />
              <input value={rewardLabel} onChange={(e) => setRewardLabel(e.target.value)} placeholder="Reward (e.g. Free Play)" className="rounded-full border border-border bg-background px-3 py-2 text-sm" required />
              <button type="submit" className="rounded-full bg-accent px-4 py-2 text-xs text-white hover:bg-accent-bright">Create</button>
            </form>
          )}
          {tasks === null ? (
            <p className="text-xs text-text-faint">Loading tasks…</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((t, i) => (
                <TaskRow key={t.id} task={t} onPatch={patchTask} onMove={(d) => moveTask(i, d)} isFirst={i === 0} isLast={i === tasks.length - 1} onDelete={deleteTask} />
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-medium text-text-dim">Submission review</p>
        <div className="mb-2 flex gap-1.5">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setStatusTab(t.key)}
              className={`rounded-full px-4 py-1.5 text-xs transition ${statusTab === t.key ? "bg-accent text-white" : "bg-panel-raised text-text-dim"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {submissions === null ? (
          <p className="text-xs text-text-faint">Loading…</p>
        ) : submissions.length === 0 ? (
          <p className="text-xs text-text-faint">No {statusTab} submissions.</p>
        ) : (
          <div className="space-y-2">
            {submissions.map((s) => (
              <div key={s.id} className="rounded-2xl border border-border bg-panel p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{s.taskTitle}</p>
                    <p className="text-xs text-text-faint">{s.visitorId.slice(0, 8)} · {formatDateTime(s.createdAt)}</p>
                    {s.proofText && <p className="mt-1 text-xs text-text-dim">{s.proofText}</p>}
                    {s.proofImageUrl && (
                      <a href={s.proofImageUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-accent-bright underline">
                        View screenshot
                      </a>
                    )}
                    {s.reviewedBy && <p className="mt-1 text-[10px] text-text-faint">Reviewed by {s.reviewedBy}</p>}
                  </div>
                  {s.status === "pending" && (
                    <div className="flex shrink-0 gap-1.5">
                      <button type="button" onClick={() => review(s.id, "approved")} className="rounded-full bg-accent px-3 py-1.5 text-xs text-white hover:bg-accent-bright">
                        Approve
                      </button>
                      <button type="button" onClick={() => review(s.id, "rejected")} className="rounded-full border border-red-500/30 px-3 py-1.5 text-xs text-red-600 hover:bg-red-500/10">
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
