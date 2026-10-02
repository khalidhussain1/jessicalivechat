"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type ProfileStats = {
  totalPoints: number;
  availableRewards: number;
  usedRewards: number;
  gamesPlayed: number;
  tasksApproved: number;
  tasksPending: number;
  challengesCompleted: number;
  drawsWon: number;
  achievements: { icon: string; label: string }[];
};

export function ProfileStatsModal({ visitorId, onClose }: { visitorId: string; onClose: () => void }) {
  const { data: session } = useSession();
  const [stats, setStats] = useState<ProfileStats | null>(null);

  useEffect(() => {
    fetch(`/api/profile/stats?visitorId=${visitorId}`)
      .then((res) => res.json())
      .then(setStats)
      .catch(() => {});
  }, [visitorId]);

  const displayName = session?.user?.name ?? "Guest";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="My profile"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-3xl border border-border bg-panel p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">My Profile</p>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-text-faint hover:bg-panel-raised">✕</button>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-xl text-white">
            {displayName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{displayName}</p>
            <p className="flex items-center gap-1 text-xs text-accent-bright">
              <span aria-hidden="true">🟢</span> Online
            </p>
          </div>
        </div>

        {!stats ? (
          <p className="py-6 text-center text-sm text-text-dim">Loading…</p>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border border-border bg-panel-raised p-2.5">
                <p className="text-lg font-bold text-foreground">{stats.totalPoints}</p>
                <p className="text-[10px] text-text-dim">Points earned</p>
              </div>
              <div className="rounded-2xl border border-border bg-panel-raised p-2.5">
                <p className="text-lg font-bold text-foreground">{stats.availableRewards}</p>
                <p className="text-[10px] text-text-dim">Rewards available</p>
              </div>
              <div className="rounded-2xl border border-border bg-panel-raised p-2.5">
                <p className="text-lg font-bold text-foreground">{stats.gamesPlayed}</p>
                <p className="text-[10px] text-text-dim">Games played</p>
              </div>
            </div>

            <div className="mb-4 space-y-1 text-xs text-text-dim">
              <div className="flex justify-between"><span>Tasks approved</span><span className="text-foreground">{stats.tasksApproved}</span></div>
              <div className="flex justify-between"><span>Tasks pending review</span><span className="text-foreground">{stats.tasksPending}</span></div>
              <div className="flex justify-between"><span>Daily challenges completed</span><span className="text-foreground">{stats.challengesCompleted}</span></div>
              <div className="flex justify-between"><span>Lucky draws won</span><span className="text-foreground">{stats.drawsWon}</span></div>
              <div className="flex justify-between"><span>Rewards used</span><span className="text-foreground">{stats.usedRewards}</span></div>
            </div>

            {stats.achievements.length > 0 && (
              <div className="mb-2">
                <p className="mb-1.5 text-xs font-medium text-text-dim">Achievements</p>
                <div className="flex flex-wrap gap-1.5">
                  {stats.achievements.map((a) => (
                    <span key={a.label} className="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] text-accent-bright">
                      {a.icon} {a.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-full bg-accent px-4 py-2 text-sm text-white hover:bg-accent-bright"
        >
          Back to Chat
        </button>
      </div>
    </div>
  );
}
