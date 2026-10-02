"use client";

import { useEffect, useState } from "react";

type AnnouncementType = "info" | "success" | "warning" | "important";
type Announcement = {
  id: number;
  text: string;
  type: AnnouncementType;
  dismissible: boolean;
  linkLabel: string | null;
  linkUrl: string | null;
};

const DISMISSED_ANNOUNCEMENTS_KEY = "jessica-dismissed-announcements";

const ANNOUNCEMENT_STYLES: Record<AnnouncementType, { icon: string; className: string }> = {
  info: { icon: "🔔", className: "border-border bg-panel text-text-dim" },
  success: { icon: "✅", className: "border-accent/30 bg-accent/10 text-accent-bright" },
  warning: { icon: "⚠️", className: "border-amber-500/30 bg-amber-500/10 text-amber-700" },
  important: { icon: "📢", className: "border-red-500/30 bg-red-500/10 text-red-600" },
};

export function AnnouncementsZone() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedIds, setDismissedIds] = useState<number[]>([]);

  useEffect(() => {
    fetch("/api/content/public")
      .then((res) => res.json())
      .then((data: { announcements?: Announcement[] }) => {
        if (data.announcements) setAnnouncements(data.announcements);
      })
      .catch(() => {});
    try {
      const raw = window.localStorage.getItem(DISMISSED_ANNOUNCEMENTS_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable client-side, read once on mount
      if (raw) setDismissedIds(JSON.parse(raw));
    } catch {
      // ignore malformed/absent localStorage value
    }
  }, []);

  function dismiss(id: number) {
    setDismissedIds((prev) => {
      const next = [...prev, id];
      window.localStorage.setItem(DISMISSED_ANNOUNCEMENTS_KEY, JSON.stringify(next));
      return next;
    });
  }

  const visible = announcements.filter((a) => !dismissedIds.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((a) => {
        const style = ANNOUNCEMENT_STYLES[a.type];
        return (
          <div
            key={a.id}
            role="status"
            className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-medium shadow-sm ${style.className}`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden="true" className="text-lg">{style.icon}</span>
              <span className="truncate">{a.text}</span>
              {a.linkUrl && a.linkLabel && (
                <a href={a.linkUrl} target="_blank" rel="noreferrer" className="shrink-0 underline underline-offset-2">
                  {a.linkLabel}
                </a>
              )}
            </span>
            {a.dismissible && (
              <button
                type="button"
                onClick={() => dismiss(a.id)}
                aria-label="Dismiss announcement"
                className="shrink-0 rounded-full p-1 opacity-70 hover:bg-black/5 hover:opacity-100"
              >
                ✕
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
