"use client";

import { useEffect, useRef, useState } from "react";

const ICONS = ["🎮", "🕹️", "🏆", "⚡", "🎯", "🧩", "🎲", "⭐"];

type Card = { id: number; icon: string; matched: boolean };

function shuffledDeck(): Card[] {
  const pairs = [...ICONS, ...ICONS];
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  return pairs.map((icon, id) => ({ id, icon, matched: false }));
}

export function MemoryGame({ onWin }: { onWin: () => void }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const wonFiredRef = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time deal shuffle on mount
    setCards(shuffledDeck());
  }, []);

  const won = cards.length > 0 && cards.every((c) => c.matched);

  useEffect(() => {
    if (won && !wonFiredRef.current) {
      wonFiredRef.current = true;
      onWin();
    }
  }, [won, onWin]);

  function flip(id: number) {
    if (flipped.length === 2 || flipped.includes(id) || cards[id]?.matched) return;
    const next = [...flipped, id];
    setFlipped(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = next;
      if (cards[a].icon === cards[b].icon) {
        setCards((prev) => prev.map((c) => (c.id === a || c.id === b ? { ...c, matched: true } : c)));
        setFlipped([]);
      } else {
        setTimeout(() => setFlipped([]), 700);
      }
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs text-text-dim">Moves: {moves}</p>
      <div className="grid grid-cols-4 gap-2">
        {cards.map((card) => {
          const isFlipped = flipped.includes(card.id) || card.matched;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => flip(card.id)}
              disabled={card.matched}
              className={`flex h-14 w-14 items-center justify-center rounded-xl border text-2xl transition sm:h-16 sm:w-16 ${
                isFlipped ? "border-accent/40 bg-accent/10" : "border-border bg-panel-raised hover:border-accent/30"
              } ${card.matched ? "opacity-50" : ""}`}
            >
              {isFlipped ? card.icon : "❓"}
            </button>
          );
        })}
      </div>
      {won && <p className="text-sm font-medium text-accent-bright">🎉 All matched in {moves} moves!</p>}
    </div>
  );
}
