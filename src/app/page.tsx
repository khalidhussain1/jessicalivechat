import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-medium text-foreground">🎮 Jessica Chat</h1>
      <p className="mt-3 max-w-md text-sm text-text-dim">
        Live customer care chat for gamers, with a real-time agent backend.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/support"
          className="rounded-full bg-accent px-6 py-3 text-sm text-white transition hover:bg-accent-bright"
        >
          Open support chat
        </Link>
        <Link
          href="/agent"
          className="rounded-full border border-border px-6 py-3 text-sm text-text-dim transition hover:border-accent/40 hover:text-accent-bright"
        >
          Agent inbox
        </Link>
      </div>
    </div>
  );
}
