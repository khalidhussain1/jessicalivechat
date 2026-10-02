"use client";

import { useEffect, useState } from "react";
import { SupportChat } from "@/components/SupportChat";
import { InstallPrompt } from "@/components/InstallPrompt";
import { HeroZone } from "@/components/home/HeroZone";
import { AnnouncementsZone } from "@/components/home/AnnouncementsZone";
import { EntertainmentZone } from "@/components/home/EntertainmentZone";
import { RewardsZone } from "@/components/home/RewardsZone";

type HomeZoneKey = "hero" | "announcements" | "chat" | "entertainment" | "rewards";
type HomeLayoutSettings = { zones: { key: HomeZoneKey; enabled: boolean }[] };

const DEFAULT_LAYOUT: HomeLayoutSettings = {
  zones: [
    { key: "hero", enabled: true },
    { key: "chat", enabled: true },
    { key: "announcements", enabled: true },
    { key: "entertainment", enabled: true },
    { key: "rewards", enabled: true },
  ],
};

const ZONE_COMPONENTS: Record<HomeZoneKey, React.ComponentType> = {
  hero: HeroZone,
  announcements: AnnouncementsZone,
  chat: SupportChat,
  entertainment: EntertainmentZone,
  rewards: RewardsZone,
};

export function HomeLayout() {
  const [layout, setLayout] = useState<HomeLayoutSettings>(DEFAULT_LAYOUT);

  useEffect(() => {
    fetch("/api/settings/public")
      .then((res) => res.json())
      .then((data: { home_layout?: HomeLayoutSettings }) => {
        if (data.home_layout?.zones?.length) setLayout(data.home_layout);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:gap-6 sm:px-6 sm:py-10">
      <h1 className="sr-only">Jessica Game Support</h1>
      <InstallPrompt />
      {layout.zones
        .filter((zone) => zone.enabled || zone.key === "chat")
        .map((zone) => {
          const Zone = ZONE_COMPONENTS[zone.key];
          return (
            <div key={zone.key} className="shrink-0">
              <Zone />
            </div>
          );
        })}
    </div>
  );
}
