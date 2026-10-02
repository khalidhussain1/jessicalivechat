"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import type { AgentInfo } from "@/components/admin/types";

export default function AgentPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/agent/me")
      .then((res) => res.json())
      .then((data: { authenticated: boolean; agent: AgentInfo | null }) =>
        setAgent(data.authenticated ? data.agent : null),
      )
      .finally(() => setAuthChecked(true));
  }, []);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoginError(null);
    const res = await fetch("/api/agent/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setUsername("");
      setPassword("");
      setAgent(data.agent);
    } else {
      setLoginError(data?.error ?? "Login failed");
    }
  }

  if (!authChecked) {
    return <div className="px-6 py-16 text-center text-text-dim">Loading…</div>;
  }

  if (!agent) {
    return (
      <div className="mx-auto w-full max-w-sm px-6 py-24">
        <h1 className="text-2xl font-medium text-foreground">Agent sign in</h1>
        <p className="mt-2 text-sm text-text-dim">Sign in to reply to Jessica chats.</p>
        <form onSubmit={handleLogin} className="mt-6 space-y-3">
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Username"
            autoComplete="username"
            aria-label="Username"
            className="w-full rounded-full border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-text-faint focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none focus:border-accent/50"
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            aria-label="Password"
            className="w-full rounded-full border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-text-faint focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none focus:border-accent/50"
          />
          {loginError && (
            <p role="alert" className="text-xs text-red-500">
              {loginError}
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-full bg-accent px-5 py-3 text-base text-white transition hover:bg-accent-bright focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none active:scale-[0.98]"
          >
            Sign in
          </button>
        </form>
      </div>
    );
  }

  return <AdminShell agent={agent} onLogout={() => setAgent(null)} />;
}
