export function StatusDot({ online }: { online: boolean }) {
  return (
    <span role="status" className="inline-flex items-center gap-1 whitespace-nowrap text-xs">
      <span aria-hidden="true">{online ? "🟢" : "⚪"}</span>
      <span className={online ? "text-emerald-600" : "text-text-faint"}>
        {online ? "Online" : "Offline"}
      </span>
    </span>
  );
}
