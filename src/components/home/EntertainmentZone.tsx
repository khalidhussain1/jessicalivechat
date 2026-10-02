"use client";

import { useEffect, useState } from "react";
import { SectionHeader, GameCard } from "@/components/home/SectionCard";
import { GameModal } from "@/components/games/GameModal";
import { MemoryGame } from "@/components/games/MemoryGame";
import { NumberGuessGame } from "@/components/games/NumberGuessGame";
import { TicTacToeGame } from "@/components/games/TicTacToeGame";
import { TriviaGame } from "@/components/games/TriviaGame";
import { useVisitorId } from "@/lib/use-visitor-id";

type GameKey = "memory" | "guess" | "trivia" | "tictactoe";

type GameInfo = {
  id: number;
  key: GameKey;
  title: string;
  description: string;
  icon: string;
  rewardLabel: string;
  enabled: boolean;
  playedToday: boolean;
  questions?: { id: number; question: string; options: string[] }[];
};

type Challenge = {
  id: number;
  title: string;
  description: string;
  rewardLabel: string;
  enabled: boolean;
  completedToday: boolean;
};

export function EntertainmentZone() {
  const visitorId = useVisitorId();
  const [games, setGames] = useState<GameInfo[]>([]);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [activeGame, setActiveGame] = useState<GameKey | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function load() {
    const qs = visitorId ? `?visitorId=${visitorId}` : "";
    fetch(`/api/games/public${qs}`)
      .then((res) => res.json())
      .then((data: { games: GameInfo[]; challenge: Challenge | null }) => {
        setGames(data.games);
        setChallenge(data.challenge);
      })
      .catch(() => {});
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-fetch once visitorId resolves, load() is stable enough for this read-only poll
  }, [visitorId]);

  async function handleWin(game: GameInfo) {
    if (!visitorId) return;
    try {
      const res = await fetch(`/api/games/${game.key}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId }),
      });
      const data = await res.json();
      if (data.ok && data.reward) {
        setToast(`🎉 You earned ${data.reward.label}!`);
      }
    } catch {
      // ignore; the game already showed its own win state
    }
    load();
    setTimeout(() => setActiveGame(null), 1200);
  }

  async function handleChallengeClaim() {
    if (!visitorId) return;
    const res = await fetch("/api/games/challenge/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId }),
    });
    const data = await res.json();
    if (data.ok && data.reward) {
      setToast(`🎉 Challenge complete — you earned ${data.reward.label}!`);
    }
    load();
  }

  const activeGameInfo = games.find((g) => g.key === activeGame);

  return (
    <section className="rounded-3xl border border-border bg-panel p-4 shadow-sm sm:p-6">
      <SectionHeader icon="🕹️" title="Entertainment" subtitle="Free mini-games and daily challenges" />

      {toast && (
        <div className="mb-3 flex items-center justify-between rounded-2xl border border-accent/30 bg-accent/10 px-4 py-2 text-sm text-accent-bright">
          {toast}
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {challenge?.enabled && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div>
            <p className="text-sm font-semibold text-amber-700">🔥 Today&apos;s Challenge — {challenge.title}</p>
            <p className="text-xs text-amber-700/80">{challenge.description}</p>
          </div>
          <button
            type="button"
            onClick={handleChallengeClaim}
            disabled={challenge.completedToday || !visitorId}
            className="shrink-0 rounded-full bg-amber-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-amber-700 disabled:opacity-50"
          >
            {challenge.completedToday ? "✓ Completed today" : `Complete for ${challenge.rewardLabel}`}
          </button>
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-1">
        {games.map((game) => (
          <GameCard
            key={game.key}
            icon={game.icon}
            title={game.title}
            description={game.description}
            reward={game.rewardLabel}
            badge={game.playedToday ? "Played today" : undefined}
            footer={
              <button
                type="button"
                onClick={() => setActiveGame(game.key)}
                disabled={game.playedToday || !visitorId}
                className="w-full rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent-bright disabled:opacity-40"
              >
                {game.playedToday ? "Come back tomorrow" : "Play now"}
              </button>
            }
          />
        ))}
      </div>

      {activeGameInfo && visitorId && (
        <GameModal title={activeGameInfo.title} icon={activeGameInfo.icon} onClose={() => setActiveGame(null)}>
          {activeGameInfo.key === "memory" && <MemoryGame onWin={() => handleWin(activeGameInfo)} />}
          {activeGameInfo.key === "guess" && <NumberGuessGame onWin={() => handleWin(activeGameInfo)} />}
          {activeGameInfo.key === "tictactoe" && <TicTacToeGame onWin={() => handleWin(activeGameInfo)} />}
          {activeGameInfo.key === "trivia" && (
            <TriviaGame
              questions={activeGameInfo.questions ?? []}
              visitorId={visitorId}
              onAnswered={(reward) => {
                if (reward) setToast(`🎉 You earned ${reward.label}!`);
                load();
                setTimeout(() => setActiveGame(null), 1500);
              }}
            />
          )}
        </GameModal>
      )}
    </section>
  );
}
