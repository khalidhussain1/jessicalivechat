"use client";

import { useCallback, useRef } from "react";

const MUTE_KEY = "jessica-sound-muted";

export function useNotificationSound() {
  const ctxRef = useRef<AudioContext | null>(null);

  const unlock = useCallback(() => {
    if (!ctxRef.current) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctxRef.current = new AudioCtx();
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume().catch(() => {});
    }
    return ctxRef.current;
  }, []);

  const tone = useCallback(
    (ctx: AudioContext, startAt: number, frequency: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(frequency, startAt);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.2, startAt + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startAt);
      osc.stop(startAt + 0.3);
    },
    [],
  );

  const play = useCallback(() => {
    if (window.localStorage.getItem(MUTE_KEY) === "1") return;
    try {
      const ctx = unlock();
      tone(ctx, ctx.currentTime, 880);
    } catch {
      // sound is a nice-to-have, never let it break the chat
    }
  }, [unlock, tone]);

  // a more attention-grabbing double-beep, distinct from the normal message ping
  const playUrgent = useCallback(() => {
    if (window.localStorage.getItem(MUTE_KEY) === "1") return;
    try {
      const ctx = unlock();
      const now = ctx.currentTime;
      tone(ctx, now, 1046);
      tone(ctx, now + 0.18, 1046);
    } catch {
      // sound is a nice-to-have, never let it break the chat
    }
  }, [unlock, tone]);

  return { play, playUrgent, unlock };
}

export function isSoundMuted() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUTE_KEY) === "1";
}

export function setSoundMuted(muted: boolean) {
  window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}
