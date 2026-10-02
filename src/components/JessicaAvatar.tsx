export function JessicaAvatar({ size = 36, imageUrl }: { size?: number; imageUrl?: string | null }) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- admin-configured asset, arbitrary source
      <img
        src={imageUrl}
        alt=""
        aria-hidden="true"
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-accent text-white"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      aria-hidden="true"
    >
      🎮
    </div>
  );
}
