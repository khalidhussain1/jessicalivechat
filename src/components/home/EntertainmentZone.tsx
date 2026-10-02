import { SectionHeader, GameCard } from "@/components/home/SectionCard";

export function EntertainmentZone() {
  return (
    <section className="rounded-3xl border border-border bg-panel p-4 shadow-sm sm:p-6">
      <SectionHeader icon="🕹️" title="Entertainment" subtitle="Free mini-games and daily challenges" />
      <div className="flex gap-3 overflow-x-auto pb-1">
        <GameCard icon="🧩" title="Memory Cards" description="Match the pairs" badge="Coming soon" />
        <GameCard icon="🎯" title="Number Guessing" description="Crack the code" badge="Coming soon" />
        <GameCard icon="🧠" title="Trivia" description="Test your gaming knowledge" badge="Coming soon" />
        <GameCard icon="❌" title="Tic-Tac-Toe" description="Beat the computer" badge="Coming soon" />
      </div>
    </section>
  );
}
