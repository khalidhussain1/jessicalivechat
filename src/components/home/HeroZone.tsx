"use client";

import { useEffect, useState } from "react";

type HeroSettings = {
  enabled: boolean;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  imageUrl: string | null;
  backgroundStyle: "gradient" | "solid";
};

const DEFAULT_HERO: HeroSettings = {
  enabled: true,
  title: "GAME SUPPORT",
  subtitle: "Your gaming community, entertainment, and support hub",
  ctaText: "",
  ctaLink: "",
  imageUrl: null,
  backgroundStyle: "gradient",
};

export function HeroZone() {
  const [hero, setHero] = useState<HeroSettings>(DEFAULT_HERO);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/settings/public")
      .then((res) => res.json())
      .then((data: { hero?: Partial<HeroSettings> }) => {
        if (data.hero) setHero((prev) => ({ ...prev, ...data.hero }));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded || !hero.enabled) return null;

  return (
    <div
      className="relative overflow-hidden rounded-3xl px-6 py-10 text-center text-white shadow-lg sm:px-10 sm:py-14"
      style={{
        background:
          hero.backgroundStyle === "gradient"
            ? "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.12), transparent 50%), linear-gradient(135deg, var(--color-accent), #0b1120)"
            : "var(--color-accent)",
      }}
    >
      <div
        className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full blur-3xl"
        style={{ background: "rgba(255,255,255,0.15)" }}
        aria-hidden="true"
      />
      {hero.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- admin-provided asset, arbitrary source
        <img src={hero.imageUrl} alt="" className="relative mx-auto mb-4 h-16 w-16 rounded-2xl object-cover shadow-md" />
      )}
      <p className="relative text-3xl font-extrabold tracking-wide sm:text-4xl">{hero.title}</p>
      <p className="relative mx-auto mt-2 max-w-md text-sm text-white/85 sm:text-base">{hero.subtitle}</p>
      {hero.ctaText && (
        <a
          href={hero.ctaLink || "#"}
          className="relative mt-6 inline-block rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black shadow transition hover:scale-[1.03] active:scale-95"
        >
          {hero.ctaText}
        </a>
      )}
    </div>
  );
}
