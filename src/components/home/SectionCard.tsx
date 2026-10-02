export function SectionHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="text-2xl" aria-hidden="true">{icon}</span>
      <div>
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-text-dim">{subtitle}</p>}
      </div>
    </div>
  );
}

export function GameCard({
  icon,
  title,
  description,
  badge,
  reward,
  footer,
}: {
  icon: string;
  title: string;
  description?: string;
  badge?: string;
  reward?: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="group relative flex min-w-[180px] shrink-0 flex-col gap-2 overflow-hidden rounded-2xl border border-border bg-panel p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md">
      <div
        className="pointer-events-none absolute -top-10 -right-10 h-24 w-24 rounded-full bg-accent/10 opacity-0 blur-2xl transition group-hover:opacity-100"
        aria-hidden="true"
      />
      <div className="relative flex items-start justify-between gap-2">
        <span className="text-3xl" aria-hidden="true">{icon}</span>
        {badge && (
          <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent-bright">
            {badge}
          </span>
        )}
      </div>
      <p className="relative text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="relative text-xs text-text-dim">{description}</p>}
      {reward && (
        <p className="relative text-xs font-medium text-amber-600">🎁 {reward}</p>
      )}
      {footer && <div className="relative mt-1">{footer}</div>}
    </div>
  );
}
