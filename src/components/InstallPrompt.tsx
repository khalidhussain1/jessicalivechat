"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "jessica-install-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");

  useEffect(() => {
    if (isStandalone()) return;
    if (window.localStorage.getItem(DISMISS_KEY) === "1") return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- platform/visibility depend on client-only APIs
    setPlatform(isIOS() ? "ios" : "android");
    setVisible(true);

    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  async function handleShowSteps() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (outcome === "accepted") setVisible(false);
      return;
    }
    setShowSteps(true);
  }

  if (!visible) return null;

  return (
    <div className="border-b border-accent/30 bg-panel px-4 py-3 md:mb-6 md:rounded-2xl md:border md:border-accent/30 md:border-b-0 md:px-5 md:py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Add Jessica Chat to your phone</p>
          <p className="text-xs text-text-dim">
            Faster access, saved chats, and a home screen icon for support.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={handleShowSteps}
            className="rounded-full bg-accent px-4 py-2 text-xs text-white transition hover:bg-accent-bright active:scale-95"
          >
            {deferredPrompt ? "Install" : "Show steps"}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full border border-border px-4 py-2 text-xs text-text-dim transition hover:border-accent/40 hover:text-accent-bright active:scale-95"
          >
            Not now
          </button>
        </div>
      </div>

      {showSteps && !deferredPrompt && (
        <div className="mt-3 rounded-xl border border-border bg-panel-raised px-4 py-3 text-xs text-text-dim">
          {platform === "ios" ? (
            <ol className="list-decimal space-y-1 pl-4">
              <li>
                Tap the <span className="text-foreground">Share</span> icon in Safari&apos;s
                toolbar.
              </li>
              <li>
                Scroll down and tap{" "}
                <span className="text-foreground">Add to Home Screen</span>.
              </li>
              <li>
                Tap <span className="text-foreground">Add</span> in the top right.
              </li>
            </ol>
          ) : (
            <ol className="list-decimal space-y-1 pl-4">
              <li>
                Open your browser menu (usually the ⋮ or ≡ icon in the top right).
              </li>
              <li>
                Tap <span className="text-foreground">Install app</span> or{" "}
                <span className="text-foreground">Add to Home screen</span>.
              </li>
              <li>Confirm to add the icon to your home screen.</li>
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
