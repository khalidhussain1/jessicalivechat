"use client";

import { useEffect, useState } from "react";
import { SectionHeader, GameCard } from "@/components/home/SectionCard";
import { useVisitorId } from "@/lib/use-visitor-id";

type Reward = { id: number; label: string; source: string; status: "available" | "pending" | "used" | "expired" };

export function RewardsZone() {
  const visitorId = useVisitorId();
  const [rewards, setRewards] = useState<Reward[] | null>(null);

  function load() {
    if (!visitorId) return;
    fetch(`/api/games/rewards?visitorId=${visitorId}`)
      .then((res) => res.json())
      .then((data: { rewards: Reward[] }) => setRewards(data.rewards))
      .catch(() => {});
  }

  useEffect(() => {
    load();
    // games/challenges grant rewards from a different component on the same page —
    // poll for freshness the same way the rest of this app keeps cross-component state
    // in sync, rather than wiring up a one-off event channel
    const interval = setInterval(load, 5000);
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
    load();
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
        <p className="mb-3 text-xs text-text-faint">Play a game in Entertainment to earn your first reward.</p>
      )}

      <p className="mb-1.5 text-xs font-medium text-text-dim">Tasks</p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        <GameCard icon="📢" title="Share our page" reward="Free Play" badge="Coming soon" />
        <GameCard icon="👍" title="Follow & engage" reward="Points" badge="Coming soon" />
        <GameCard icon="🎟️" title="Daily Free Draw" description="Free promotional draw" badge="Coming soon" />
      </div>
    </section>
  );
}
