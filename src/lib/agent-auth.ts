import { SignJWT, jwtVerify } from "jose";

export type AgentSession = { id: string; name: string; username: string };

export const AGENT_COOKIE = "jessica_agent_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret() {
  const secret = process.env.AGENT_SESSION_SECRET;
  if (!secret) {
    throw new Error("AGENT_SESSION_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function createAgentSessionToken(agent: AgentSession): Promise<string> {
  return new SignJWT({ id: agent.id, name: agent.name, username: agent.username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyAgentSessionToken(
  token: string | undefined,
): Promise<AgentSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.id === "string" &&
      typeof payload.name === "string" &&
      typeof payload.username === "string"
    ) {
      return { id: payload.id, name: payload.name, username: payload.username };
    }
    return null;
  } catch {
    return null;
  }
}
