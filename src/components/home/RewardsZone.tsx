"use client";

import { useEffect, useState } from "react";
import { SectionHeader, GameCard } from "@/components/home/SectionCard";
import { TaskModal } from "@/components/home/TaskModal";
import { useVisitorId } from "@/lib/use-visitor-id";

type Reward = { id: number; label: string; source: string; status: "available" | "pending" | "used" | "expired" };
type Task = { id: number; title: string; description: string; instructions: string; rewardLabel: string; hasOpenSubmission: boolean };

export function RewardsZone() {
  const visitorId = useVisitorId();
  const [rewards, setRewards] = useState<Reward[] | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  function loadRewards() {
    if (!visitorId) return;
    fetch(`/api/games/rewards?visitorId=${visitorId}`)
      .then((res) => res.json())
      .then((data: { rewards: Reward[] }) => setRewards(data.rewards))
      .catch(() => {});
  }

  function loadTasks() {
    const qs = visitorId ? `?visitorId=${visitorId}` : "";
    fetch(`/api/tasks/public${qs}`)
      .then((res) => res.json())
      .then((data: { tasks: Task[] }) => setTasks(data.tasks))
      .catch(() => {});
  }

  useEffect(() => {
    loadRewards();
    loadTasks();
    // games/challenges/task-approvals grant rewards from elsewhere on the page — poll
    // for freshness the same way the rest of this app keeps cross-component state in sync
    const interval = setInterval(() => {
      loadRewards();
      loadTasks();
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-fetch once visitorId resolves
  }, [visitorId]);

  async function claimRewardLocal(id: number) {
    if (!visitorId) return;
    await fetch("/api/games/rewards/use", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, rewardId: id }),
    });
    loadRewards();
  }

  const available = rewards?.filter((r) => r.status === "available") ?? [];
  const used = rewards?.filter((r) => r.status === "used") ?? [];

  return (
    <section className="rounded-3xl border border-border bg-panel p-4 shadow-sm sm:p-6">
      <SectionHeader icon="🎁" title="Rewards & Free Play" subtitle="Complete tasks and games to earn free rewards" />

      {available.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-xs font-medium text-text-dim">🎉 Available to claim</p>
          <div className="flex flex-wrap gap-2">
            {available.map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 py-1.5 pr-1.5 pl-3 text-xs text-accent-bright">
                🎁 {r.label}
                <button type="button" onClick={() => claimRewardLocal(r.id)} className="rounded-full bg-accent px-2.5 py-1 text-white hover:bg-accent-bright">
                  Use
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {rewards !== null && available.length === 0 && used.length === 0 && (
        <p className="mb-3 text-xs text-text-faint">Play a game in Entertainment or complete a task to earn your first reward.</p>
      )}

      <p className="mb-1.5 text-xs font-medium text-text-dim">Tasks</p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {tasks.map((task) => (
          <GameCard
            key={task.id}
            icon="📢"
            title={task.title}
            description={task.description}
            reward={task.rewardLabel}
            badge={task.hasOpenSubmission ? "Pending review" : undefined}
            footer={
              <button
                type="button"
                onClick={() => setActiveTask(task)}
                disabled={task.hasOpenSubmission || !visitorId}
                className="w-full rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent-bright disabled:opacity-40"
              >
                {task.hasOpenSubmission ? "Awaiting review" : "Complete Task"}
              </button>
            }
          />
        ))}
        <GameCard icon="🎟️" title="Daily Free Draw" description="Free promotional draw" badge="Coming soon" />
      </div>

      {activeTask && visitorId && (
        <TaskModal
          task={activeTask}
          visitorId={visitorId}
          onClose={() => setActiveTask(null)}
          onSubmitted={() => {
            loadTasks();
            setTimeout(() => setActiveTask(null), 1500);
          }}
        />
      )}
    </section>
  );
}
