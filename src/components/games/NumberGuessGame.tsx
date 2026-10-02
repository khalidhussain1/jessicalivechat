"use client";

import { useState } from "react";

// 7 tries so a 1-100 range is always winnable with optimal binary search (needs up to 7)
const MAX_TRIES = 7;

export function NumberGuessGame({ onWin }: { onWin: () => void }) {
  // lazy initializer — runs once on mount, not on every render, so Math.random() here is fine
  const [target] = useState(() => Math.floor(Math.random() * 100) + 1);
  const [guess, setGuess] = useState("");
  const [history, setHistory] = useState<{ value: number; hint: "higher" | "lower" | "correct" }[]>([]);
  const [done, setDone] = useState(false);

  function submitGuess(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(guess);
    if (!value || value < 1 || value > 100 || done) return;
    setGuess("");

    if (value === target) {
      setHistory((h) => [...h, { value, hint: "correct" }]);
      setDone(true);
      onWin();
      return;
    }
    const hint = value < target ? "higher" : "lower";
    const next = [...history, { value, hint: hint as "higher" | "lower" }];
    setHistory(next);
    if (next.length >= MAX_TRIES) setDone(true);
  }

  const won = history[history.length - 1]?.hint === "correct";
  const triesLeft = MAX_TRIES - history.length;

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs text-text-dim">Guess a number between 1 and 100 — {triesLeft} tries left</p>
      {!done && (
        <form onSubmit={submitGuess} className="flex gap-2">
          <input
            type="number"
            min={1}
            max={100}
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            className="w-24 rounded-full border border-border bg-background px-3 py-1.5 text-center text-sm"
            autoFocus
          />
          <button type="submit" className="rounded-full bg-accent px-4 py-1.5 text-sm text-white hover:bg-accent-bright">
            Guess
          </button>
        </form>
      )}
      <div className="flex flex-wrap justify-center gap-1.5">
        {history.map((h, i) => (
          <span
            key={i}
            className={`rounded-full px-2.5 py-1 text-xs ${
              h.hint === "correct" ? "bg-accent text-white" : "bg-panel-raised text-text-dim"
            }`}
          >
            {h.value} {h.hint === "higher" ? "↑" : h.hint === "lower" ? "↓" : "✓"}
          </span>
        ))}
      </div>
      {won && <p className="text-sm font-medium text-accent-bright">🎉 Correct! It was {target}.</p>}
      {done && !won && (
        <p className="text-sm text-text-dim">Out of tries — the number was {target}. Come back tomorrow!</p>
      )}
    </div>
  );
}
