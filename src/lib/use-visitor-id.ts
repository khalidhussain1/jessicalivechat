"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const VISITOR_KEY = "jessica-visitor-id";
const GUEST_KEY = "jessica-guest-mode";

// SupportChat.tsx dispatches this whenever guest mode is entered/exited — a pure
// local state change in that component that next-auth's useSession() never observes,
// so any OTHER component resolving visitorId needs its own signal to re-check
export const GUEST_MODE_CHANGED_EVENT = "jessica-guest-mode-changed";

// mirrors the exact visitorId resolution in SupportChat.tsx so games/rewards/draws
// tie to the SAME identity as the customer's chat conversation — a logged-in
// customer's visitorId is their users.id; a guest's is a persisted localStorage UUID
export function useVisitorId(): string | null {
  const { data: session, status } = useSession();
  const [visitorId, setVisitorId] = useState<string | null>(null);

  useEffect(() => {
    function resolve() {
      if (status === "loading") return;
      const guestMode = window.localStorage.getItem(GUEST_KEY) === "1";
      const ready = status === "authenticated" || guestMode;
      if (!ready) {
        setVisitorId(null);
        return;
      }

      if (session?.user?.id) {
        setVisitorId(session.user.id);
        return;
      }
      let id = window.localStorage.getItem(VISITOR_KEY) ?? "";
      if (!id) {
        id = crypto.randomUUID();
        window.localStorage.setItem(VISITOR_KEY, id);
      }
      setVisitorId(id);
    }

    resolve();
    window.addEventListener(GUEST_MODE_CHANGED_EVENT, resolve);
    window.addEventListener("storage", resolve);
    return () => {
      window.removeEventListener(GUEST_MODE_CHANGED_EVENT, resolve);
      window.removeEventListener("storage", resolve);
    };
  }, [status, session?.user?.id]);

  return visitorId;
}
