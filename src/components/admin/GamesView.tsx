"use client";

import { useEffect, useState } from "react";

type Game = {
  id: number;
  key: string;
  title: string;
  description: string;
  icon: string;
  rewardType: string;
  rewardLabel: string;
  enabled: boolean;
  sortOrder: number;
};

type Challenge = {
  id: number;
  title: string;
  description: string;
  rewardType: string;
  rewardLabel: string;
  enabled: boolean;
};

type QuizQuestion = { id: number; question: string; options: string[]; correctIndex: number };

function GameRow({ game, onPatch, onMove, isFirst, isLast }: {
  game: Game;
  onPatch: (id: number, patch: Partial<Game>) => void;
  onMove: (direction: -1 | 1) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [showQuestions, setShowQuestions] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [newQuestion, setNewQuestion] = useState("");
  const [newOptions, setNewOptions] = useState(["", "", ""]);
  const [newCorrect, setNewCorrect] = useState(0);

  function loadQuestions() {
    fetch(`/api/admin/games/${game.id}/questions`)
      .then((res) => res.json())
      .then((data: { questions: QuizQuestion[] }) => setQuestions(data.questions));
  }

  async function addQuestion(e: React.FormEvent) {
    e.preventDefault();
    const options = newOptions.filter((o) => o.trim());
    if (!newQuestion.trim() || options.length < 2) return;
    await fetch(`/api/admin/games/${game.id}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: newQuestion, options, correctIndex: newCorrect }),
    });
    setNewQuestion("");
    setNewOptions(["", "", ""]);
    setNewCorrect(0);
    loadQuestions();
  }

  async function deleteQuestion(id: number) {
    await fetch(`/api/admin/games/${game.id}/questions/${id}`, { method: "DELETE" });
    loadQuestions();
  }

  return (
    <div className="rounded-2xl border border-border bg-panel p-3">
      <div className="flex items-center gap-3">
        <div className="flex shrink-0 flex-col">
          <button type="button" disabled={isFirst} onClick={() => onMove(-1)} className="text-text-faint hover:text-accent-bright disabled:opacity-30">▲</button>
          <button type="button" disabled={isLast} onClick={() => onMove(1)} className="text-text-faint hover:text-accent-bright disabled:opacity-30">▼</button>
        </div>
        <span className="shrink-0 text-2xl">{game.icon}</span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <input
            value={game.title}
            onChange={(e) => onPatch(game.id, { title: e.target.value })}
            className="w-full rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium"
          />
          <input
            value={game.description}
            onChange={(e) => onPatch(game.id, { description: e.target.value })}
            className="w-full rounded-full border border-border bg-background px-3 py-1 text-xs text-text-dim"
          />
          <input
            value={game.rewardLabel}
            onChange={(e) => onPatch(game.id, { rewardLabel: e.target.value })}
            placeholder="Reward (e.g. 20 points)"
            className="w-full rounded-full border border-border bg-background px-3 py-1 text-xs"
          />
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <button
            type="button"
            onClick={() => onPatch(game.id, { enabled: !game.enabled })}
            className={`rounded-full border px-3 py-1.5 text-xs ${game.enabled ? "border-border text-text-dim" : "border-red-500/30 text-red-600"}`}
          >
            {game.enabled ? "Enabled" : "Disabled"}
          </button>
          {game.key === "trivia" && (
            <button
              type="button"
              onClick={() => {
                setShowQuestions((v) => !v);
                if (!questions) loadQuestions();
              }}
              className="rounded-full border border-border px-3 py-1.5 text-xs text-text-dim hover:border-accent/40"
            >
              Questions
            </button>
          )}
        </div>
      </div>

      {showQuestions && (
        <div className="mt-3 space-y-2 rounded-xl border border-border p-3">
          {questions === null ? (
            <p className="text-xs text-text-faint">Loading…</p>
          ) : (
            <>
              {questions.map((q) => (
                <div key={q.id} className="flex items-center justify-between gap-2 rounded-lg bg-panel-raised px-3 py-2 text-xs">
                  <div>
                    <p className="text-foreground">{q.question}</p>
                    <p className="text-text-faint">{q.options.join(" / ")} — correct: {q.options[q.correctIndex]}</p>
                  </div>
                  <button type="button" onClick={() => deleteQuestion(q.id)} className="shrink-0 text-text-faint hover:text-red-500">Delete</button>
                </div>
              ))}
              <form onSubmit={addQuestion} className="space-y-1.5">
                <input value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} placeholder="Question" className="w-full rounded-full border border-border bg-background px-3 py-1.5 text-xs" />
                <div className="grid grid-cols-3 gap-1.5">
                  {newOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <input type="radio" checked={newCorrect === i} onChange={() => setNewCorrect(i)} />
                      <input
                        value={opt}
                        onChange={(e) => setNewOptions((prev) => prev.map((o, idx) => (idx === i ? e.target.value : o)))}
                        placeholder={`Option ${i + 1}`}
                        className="w-full rounded-full border border-border bg-background px-2 py-1 text-xs"
                      />
                    </div>
                  ))}
                </div>
                <button type="submit" className="rounded-full bg-accent px-3 py-1.5 text-xs text-white hover:bg-accent-bright">Add question</button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function GamesView() {
  const [games, setGames] = useState<Game[] | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);

  function loadGames() {
    fetch("/api/admin/games").then((res) => res.json()).then((d: { games: Game[] }) => setGames(d.games));
  }
  function loadChallenge() {
    fetch("/api/admin/challenge").then((res) => res.json()).then((d: { challenge: Challenge | null }) => setChallenge(d.challenge));
  }

  useEffect(() => {
    loadGames();
    loadChallenge();
  }, []);

  async function patchGame(id: number, patch: Partial<Game>) {
    setGames((prev) => prev?.map((g) => (g.id === id ? { ...g, ...patch } : g)) ?? null);
    await fetch(`/api/admin/games/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  function moveGame(index: number, direction: -1 | 1) {
    if (!games) return;
    const target = games[index + direction];
    if (!target) return;
    const current = games[index];
    patchGame(current.id, { sortOrder: target.sortOrder });
    patchGame(target.id, { sortOrder: current.sortOrder });
  }

  async function patchChallenge(patch: Partial<Challenge>) {
    if (!challenge) return;
    setChallenge({ ...challenge, ...patch });
    await fetch("/api/admin/challenge", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  if (!games) {
    return <div className="px-4 py-10 text-center text-sm text-text-dim">Loading games…</div>;
  }

  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto bg-panel p-4 md:rounded-2xl md:border md:border-border md:p-6 md:shadow-lg md:shadow-black/10">
      <div>
        <p className="mb-2 text-xs font-medium text-text-dim">Mini-games</p>
        <div className="space-y-2">
          {games.map((g, i) => (
            <GameRow key={g.id} game={g} onPatch={patchGame} onMove={(d) => moveGame(i, d)} isFirst={i === 0} isLast={i === games.length - 1} />
          ))}
        </div>
      </div>

      {challenge && (
        <div>
          <p className="mb-2 text-xs font-medium text-text-dim">Daily Challenge</p>
          <div className="space-y-2 rounded-2xl border border-border bg-panel p-3">
            <input
              value={challenge.title}
              onChange={(e) => patchChallenge({ title: e.target.value })}
              className="w-full rounded-full border border-border bg-background px-3 py-1.5 text-sm"
            />
            <input
              value={challenge.description}
              onChange={(e) => patchChallenge({ description: e.target.value })}
              className="w-full rounded-full border border-border bg-background px-3 py-1 text-xs text-text-dim"
            />
            <input
              value={challenge.rewardLabel}
              onChange={(e) => patchChallenge({ rewardLabel: e.target.value })}
              className="w-full rounded-full border border-border bg-background px-3 py-1 text-xs"
            />
            <button
              type="button"
              onClick={() => patchChallenge({ enabled: !challenge.enabled })}
              className={`rounded-full border px-3 py-1.5 text-xs ${challenge.enabled ? "border-border text-text-dim" : "border-red-500/30 text-red-600"}`}
            >
              {challenge.enabled ? "Enabled" : "Disabled"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
