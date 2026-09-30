"use client";

import { useEffect, useState } from "react";

type Profile = { name: string; email: string; phone: string | null };

export function ProfileModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/profile")
      .then((res) => res.json())
      .then((data: Profile) => {
        if (cancelled) return;
        setEmail(data.email);
        setName(data.name);
        setPhone(data.phone ?? "");
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your profile.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    setSaved(false);

    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Couldn't save your profile.");
        setSaving(false);
        return;
      }
      onSaved(data.name);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Couldn't save your profile. Try again.");
    }
    setSaving(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-panel p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-lg font-medium text-foreground">👤 Your profile</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-text-dim hover:text-accent-bright"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-text-dim">Loading…</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-text-dim">Email</label>
              <input
                value={email}
                disabled
                className="w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm text-text-faint"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-dim">Name</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className="w-full rounded-full border border-border bg-background px-4 py-2.5 text-base text-foreground focus:border-accent/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-dim">Phone (optional)</label>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="e.g. +1 555 123 4567"
                className="w-full rounded-full border border-border bg-background px-4 py-2.5 text-base text-foreground placeholder:text-text-faint focus:border-accent/50 focus:outline-none"
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-full bg-accent px-5 py-3 text-base text-white transition hover:bg-accent-bright active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? "Saving…" : saved ? "Saved!" : "Save changes"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
