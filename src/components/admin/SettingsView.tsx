"use client";

import { useEffect, useRef, useState } from "react";

// kept in sync with (but not imported from) src/lib/settings-db.ts, which is a
// server-only module — importing its value exports here would pull `db.ts` (and
// its DATABASE_URL check) into the client bundle and crash on load
type AppearanceSettings = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  borderRadius: number;
  logoUrl: string | null;
  avatarUrl: string | null;
  supportName: string;
  supportSubtitle: string;
  welcomeMessage: string;
};

type SupportAvailabilitySettings = {
  status: "online" | "offline" | "away";
  offlineMessage: string;
};

const DEFAULT_APPEARANCE: AppearanceSettings = {
  primaryColor: "#16a34a",
  secondaryColor: "#15803d",
  accentColor: "#16a34a",
  backgroundColor: "#f4f8f6",
  borderRadius: 24,
  logoUrl: null,
  avatarUrl: null,
  supportName: "Jessica",
  supportSubtitle: "Game Support",
  welcomeMessage: "You're chatting with Jessica, your gamer support crew. Send a message to get started.",
};

const DEFAULT_SUPPORT_AVAILABILITY: SupportAvailabilitySettings = {
  status: "online",
  offlineMessage: "Support is currently offline. You can still leave a message and we'll get back to you.",
};

type Tab = "appearance" | "availability";

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-text-dim">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
          aria-label={label}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 rounded-full border border-border bg-background px-2.5 py-1 text-xs"
        />
      </span>
    </label>
  );
}

function AppearanceTab() {
  const [draft, setDraft] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);
  const [saved, setSaved] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [uploading, setUploading] = useState<"logo" | "avatar" | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/settings/appearance")
      .then((res) => res.json())
      .then((data: { value: AppearanceSettings }) => {
        setDraft(data.value);
        setSaved(data.value);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  function set<K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function handleUpload(field: "logoUrl" | "avatarUrl", file: File) {
    setUploading(field === "logoUrl" ? "logo" : "avatar");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) set(field, data.url);
    } catch {
      // ignore; user can retry the upload
    }
    setUploading(null);
  }

  async function save() {
    setStatus("saving");
    try {
      const res = await fetch("/api/admin/settings/appearance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (res.ok) {
        setSaved(data.value);
        setDraft(data.value);
        setStatus("saved");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  async function reset() {
    const res = await fetch("/api/admin/settings/appearance", { method: "DELETE" });
    if (res.ok) {
      setDraft(DEFAULT_APPEARANCE);
      setSaved(DEFAULT_APPEARANCE);
      setStatus("saved");
    }
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  if (!loaded) {
    return <div className="px-4 py-10 text-center text-sm text-text-dim">Loading appearance settings…</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <div className="space-y-2 rounded-2xl border border-border bg-panel p-4">
          <p className="text-xs font-medium text-text-dim">Colors</p>
          <ColorField label="Primary / Accent" value={draft.primaryColor} onChange={(v) => { set("primaryColor", v); set("accentColor", v); }} />
          <ColorField label="Secondary" value={draft.secondaryColor} onChange={(v) => set("secondaryColor", v)} />
          <ColorField label="Background" value={draft.backgroundColor} onChange={(v) => set("backgroundColor", v)} />
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-text-dim">Border radius</span>
            <input
              type="range"
              min={0}
              max={32}
              value={draft.borderRadius}
              onChange={(e) => set("borderRadius", Number(e.target.value))}
              className="w-32"
            />
            <span className="w-10 text-right text-xs text-text-dim">{draft.borderRadius}px</span>
          </label>
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-panel p-4">
          <p className="text-xs font-medium text-text-dim">Branding</p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-dim">Logo</span>
            <div className="flex items-center gap-2">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleUpload("logoUrl", e.target.files[0])}
              />
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploading === "logo"}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-text-dim hover:border-accent/40 hover:text-accent-bright"
              >
                {uploading === "logo" ? "Uploading…" : draft.logoUrl ? "Replace" : "Upload"}
              </button>
              {draft.logoUrl && (
                <button type="button" onClick={() => set("logoUrl", null)} className="text-xs text-text-faint hover:text-red-500">
                  Remove
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-dim">Jessica avatar</span>
            <div className="flex items-center gap-2">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleUpload("avatarUrl", e.target.files[0])}
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploading === "avatar"}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-text-dim hover:border-accent/40 hover:text-accent-bright"
              >
                {uploading === "avatar" ? "Uploading…" : draft.avatarUrl ? "Replace" : "Upload"}
              </button>
              {draft.avatarUrl && (
                <button type="button" onClick={() => set("avatarUrl", null)} className="text-xs text-text-faint hover:text-red-500">
                  Remove
                </button>
              )}
            </div>
          </div>
          <label className="block text-sm">
            <span className="text-text-dim">Support name</span>
            <input
              value={draft.supportName}
              onChange={(e) => set("supportName", e.target.value)}
              className="mt-1 w-full rounded-full border border-border bg-background px-3.5 py-2 text-sm"
              maxLength={40}
            />
          </label>
          <label className="block text-sm">
            <span className="text-text-dim">Subtitle</span>
            <input
              value={draft.supportSubtitle}
              onChange={(e) => set("supportSubtitle", e.target.value)}
              className="mt-1 w-full rounded-full border border-border bg-background px-3.5 py-2 text-sm"
              maxLength={40}
            />
          </label>
          <label className="block text-sm">
            <span className="text-text-dim">Welcome message</span>
            <textarea
              value={draft.welcomeMessage}
              onChange={(e) => set("welcomeMessage", e.target.value)}
              rows={3}
              className="mt-1 w-full resize-none rounded-2xl border border-border bg-background px-3.5 py-2 text-sm"
              maxLength={300}
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || status === "saving"}
            className="rounded-full bg-accent px-5 py-2 text-sm text-white transition hover:bg-accent-bright disabled:opacity-40"
          >
            {status === "saving" ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-full border border-border px-4 py-2 text-sm text-text-dim hover:border-accent/40 hover:text-accent-bright"
          >
            Reset to default
          </button>
          {status === "saved" && !dirty && <span className="text-xs text-accent-bright">Saved ✓</span>}
          {status === "error" && <span className="text-xs text-red-500">Could not save</span>}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-text-dim">Live preview</p>
        <div
          className="overflow-hidden border border-border shadow-sm"
          style={{ backgroundColor: draft.backgroundColor, borderRadius: draft.borderRadius }}
        >
          <div className="flex items-center gap-2.5 border-b border-black/5 px-4 py-3" style={{ backgroundColor: "#fff" }}>
            {draft.logoUrl || draft.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin-provided preview asset, arbitrary source
              <img src={draft.avatarUrl ?? draft.logoUrl ?? undefined} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
                style={{ backgroundColor: draft.primaryColor }}
              >
                🎮
              </div>
            )}
            <div>
              <p className="text-base font-medium" style={{ color: "#10201a" }}>{draft.supportName}</p>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: `${draft.primaryColor}1a`, color: draft.secondaryColor }}
              >
                {draft.supportSubtitle}
              </span>
            </div>
          </div>
          <div className="space-y-3 p-4">
            <div
              className="max-w-[80%] px-4 py-2.5 text-sm"
              style={{ backgroundColor: "#eef5f1", color: "#10201a", borderRadius: draft.borderRadius }}
            >
              {draft.welcomeMessage}
            </div>
            <div
              className="ml-auto max-w-[70%] px-4 py-2.5 text-sm text-white"
              style={{ backgroundColor: draft.primaryColor, borderRadius: draft.borderRadius }}
            >
              Sample customer message
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AvailabilityTab() {
  const [draft, setDraft] = useState<SupportAvailabilitySettings>(DEFAULT_SUPPORT_AVAILABILITY);
  const [saved, setSaved] = useState<SupportAvailabilitySettings>(DEFAULT_SUPPORT_AVAILABILITY);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    fetch("/api/admin/settings/support_availability")
      .then((res) => res.json())
      .then((data: { value: SupportAvailabilitySettings }) => {
        setDraft(data.value);
        setSaved(data.value);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  async function save() {
    setStatus("saving");
    try {
      const res = await fetch("/api/admin/settings/support_availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (res.ok) {
        setSaved(data.value);
        setDraft(data.value);
        setStatus("saved");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const statusOptions: { key: SupportAvailabilitySettings["status"]; label: string }[] = [
    { key: "online", label: "🟢 Support Online" },
    { key: "away", label: "🟡 Away" },
    { key: "offline", label: "🔴 Support Offline" },
  ];

  if (!loaded) {
    return <div className="px-4 py-10 text-center text-sm text-text-dim">Loading availability settings…</div>;
  }

  return (
    <div className="max-w-md space-y-4 rounded-2xl border border-border bg-panel p-4">
      <div className="flex gap-2">
        {statusOptions.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setDraft((d) => ({ ...d, status: opt.key }))}
            className={`rounded-full border px-3 py-2 text-xs transition ${
              draft.status === opt.key
                ? "border-accent bg-accent/10 text-accent-bright"
                : "border-border text-text-dim hover:border-accent/40"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <label className="block text-sm">
        <span className="text-text-dim">Offline message shown to customers</span>
        <textarea
          value={draft.offlineMessage}
          onChange={(e) => setDraft((d) => ({ ...d, offlineMessage: e.target.value }))}
          rows={3}
          className="mt-1 w-full resize-none rounded-2xl border border-border bg-background px-3.5 py-2 text-sm"
          maxLength={300}
        />
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || status === "saving"}
          className="rounded-full bg-accent px-5 py-2 text-sm text-white transition hover:bg-accent-bright disabled:opacity-40"
        >
          {status === "saving" ? "Saving…" : "Save changes"}
        </button>
        {status === "saved" && !dirty && <span className="text-xs text-accent-bright">Saved ✓</span>}
      </div>
    </div>
  );
}

export function SettingsView() {
  const [tab, setTab] = useState<Tab>("appearance");

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mb-4 flex gap-1.5">
        <button
          type="button"
          onClick={() => setTab("appearance")}
          className={`rounded-full px-4 py-1.5 text-xs transition ${
            tab === "appearance" ? "bg-accent text-white" : "bg-panel-raised text-text-dim"
          }`}
        >
          Appearance
        </button>
        <button
          type="button"
          onClick={() => setTab("availability")}
          className={`rounded-full px-4 py-1.5 text-xs transition ${
            tab === "availability" ? "bg-accent text-white" : "bg-panel-raised text-text-dim"
          }`}
        >
          Support Availability
        </button>
      </div>
      {tab === "appearance" ? <AppearanceTab /> : <AvailabilityTab />}
    </div>
  );
}
