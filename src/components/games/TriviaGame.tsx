"use client";

import { useState } from "react";

type Question = { id: number; question: string; options: string[] };

export function TriviaGame({
  questions,
  visitorId,
  onAnswered,
}: {
  questions: Question[];
  visitorId: string;
  onAnswered: (reward: { label: string } | null) => void;
}) {
  const [question] = useState(() => questions[Math.floor(Math.random() * questions.length)]);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<"correct" | "wrong" | "already_played" | null>(null);

  async function submit(index: number) {
    if (submitting || result) return;
    setSelected(index);
    setSubmitting(true);
    try {
      const res = await fetch("/api/games/trivia/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId, questionId: question.id, selectedIndex: index }),
      });
      const data = await res.json();
      if (!data.ok && data.reason === "already_played") {
        setResult("already_played");
        onAnswered(null);
      } else if (data.correct) {
        setResult("correct");
        onAnswered(data.reward ?? null);
      } else {
        setResult("wrong");
        onAnswered(null);
      }
    } catch {
      setResult("wrong");
      onAnswered(null);
    }
    setSubmitting(false);
  }

  if (!question) {
    return <p className="text-sm text-text-faint">No trivia questions yet — check back soon.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-center text-sm font-medium text-foreground">{question.question}</p>
      <div className="flex w-full flex-col gap-2 sm:max-w-xs">
        {question.options.map((option, index) => (
          <button
            key={index}
            type="button"
            onClick={() => submit(index)}
            disabled={submitting || !!result}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              selected === index && result === "correct"
                ? "border-accent bg-accent/10 text-accent-bright"
                : selected === index && result === "wrong"
                  ? "border-red-500/40 bg-red-500/10 text-red-600"
                  : "border-border text-text-dim hover:border-accent/30"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
      {result === "correct" && <p className="text-sm font-medium text-accent-bright">🎉 Correct!</p>}
      {result === "wrong" && <p className="text-sm text-text-dim">Not quite — come back tomorrow for another question.</p>}
      {result === "already_played" && <p className="text-sm text-text-dim">You&apos;ve already played trivia today.</p>}
    </div>
  );
}
