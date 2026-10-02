"use client";

import { useEffect, useRef, useState } from "react";

type Cell = "X" | "O" | null;

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function winner(board: Cell[]): Cell {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

function computerMove(board: Cell[]): number {
  const empty = board.map((c, i) => (c ? -1 : i)).filter((i) => i !== -1);
  // try to win, then block, else random — simple enough for a free mini-game
  for (const i of empty) {
    const copy = [...board];
    copy[i] = "O";
    if (winner(copy) === "O") return i;
  }
  for (const i of empty) {
    const copy = [...board];
    copy[i] = "X";
    if (winner(copy) === "X") return i;
  }
  return empty[Math.floor(Math.random() * empty.length)];
}

export function TicTacToeGame({ onWin }: { onWin: () => void }) {
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [turn, setTurn] = useState<"player" | "computer">("player");
  const winFiredRef = useRef(false);

  const w = winner(board);
  const result: "win" | "lose" | "draw" | null = w === "X" ? "win" : w === "O" ? "lose" : board.every(Boolean) ? "draw" : null;

  useEffect(() => {
    if (turn !== "computer" || result) return;
    const timeout = setTimeout(() => {
      setBoard((prev) => {
        const next = [...prev];
        next[computerMove(next)] = "O";
        return next;
      });
      setTurn("player");
    }, 400);
    return () => clearTimeout(timeout);
  }, [turn, result]);

  useEffect(() => {
    if (result === "win" && !winFiredRef.current) {
      winFiredRef.current = true;
      onWin();
    }
  }, [result, onWin]);

  function play(i: number) {
    if (board[i] || turn !== "player" || result) return;
    const next = [...board];
    next[i] = "X";
    setBoard(next);
    setTurn("computer");
  }

  function reset() {
    winFiredRef.current = false;
    setBoard(Array(9).fill(null));
    setTurn("player");
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs text-text-dim">You are X — beat the computer</p>
      <div className="grid grid-cols-3 gap-1.5">
        {board.map((cell, i) => (
          <button
            key={i}
            type="button"
            onClick={() => play(i)}
            disabled={!!cell || turn !== "player" || !!result}
            className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-panel-raised text-2xl font-bold text-foreground hover:border-accent/30 sm:h-16 sm:w-16"
          >
            {cell}
          </button>
        ))}
      </div>
      {result === "win" && <p className="text-sm font-medium text-accent-bright">🎉 You win!</p>}
      {result === "lose" && (
        <div className="flex items-center gap-2">
          <p className="text-sm text-text-dim">The computer won this time.</p>
          <button type="button" onClick={reset} className="rounded-full border border-border px-3 py-1 text-xs hover:border-accent/40">
            Try again
          </button>
        </div>
      )}
      {result === "draw" && (
        <div className="flex items-center gap-2">
          <p className="text-sm text-text-dim">It&apos;s a draw.</p>
          <button type="button" onClick={reset} className="rounded-full border border-border px-3 py-1 text-xs hover:border-accent/40">
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
