"use client";

export function GameModal({
  title,
  icon,
  onClose,
  children,
}: {
  title: string;
  icon: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-3xl border border-border bg-panel p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="text-xl" aria-hidden="true">{icon}</span>
            {title}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close game"
            className="rounded-full p-1 text-text-faint hover:bg-panel-raised hover:text-accent-bright"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
