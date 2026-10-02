import { SectionHeader, GameCard } from "@/components/home/SectionCard";

export function RewardsZone() {
  return (
    <section className="rounded-3xl border border-border bg-panel p-4 shadow-sm sm:p-6">
      <SectionHeader icon="🎁" title="Rewards & Free Play" subtitle="Complete tasks to earn free rewards" />
      <div className="flex gap-3 overflow-x-auto pb-1">
        <GameCard icon="📢" title="Share our page" reward="Free Play" badge="Coming soon" />
        <GameCard icon="👍" title="Follow & engage" reward="Points" badge="Coming soon" />
        <GameCard icon="🎟️" title="Daily Free Draw" description="Free promotional draw" badge="Coming soon" />
      </div>
    </section>
  );
}
