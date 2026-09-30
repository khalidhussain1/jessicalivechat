import { randomUUID } from "crypto";
import { sql, ensureSchema } from "@/lib/db";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  provider: "credentials" | "google";
  createdAt: number;
};

export async function getUserByEmail(email: string): Promise<AppUser | undefined> {
  await ensureSchema();
  const rows = await sql`
    SELECT id, email, name, password_hash as "passwordHash", provider, created_at as "createdAt"
    FROM users WHERE email = ${email.toLowerCase()}
  `;
  const row = rows[0];
  return row ? { ...row, createdAt: Number(row.createdAt) } as AppUser : undefined;
}

export async function createCredentialsUser(
  email: string,
  name: string,
  passwordHash: string,
): Promise<AppUser> {
  await ensureSchema();
  const id = randomUUID();
  const now = Date.now();
  await sql`
    INSERT INTO users (id, email, name, password_hash, provider, created_at)
    VALUES (${id}, ${email.toLowerCase()}, ${name}, ${passwordHash}, 'credentials', ${now})
  `;
  return { id, email: email.toLowerCase(), name, passwordHash, provider: "credentials", createdAt: now };
}

export async function upsertGoogleUser(email: string, name: string): Promise<AppUser> {
  const existing = await getUserByEmail(email);
  if (existing) return existing;

  const id = randomUUID();
  const now = Date.now();
  await sql`
    INSERT INTO users (id, email, name, password_hash, provider, created_at)
    VALUES (${id}, ${email.toLowerCase()}, ${name}, NULL, 'google', ${now})
  `;
  return { id, email: email.toLowerCase(), name, passwordHash: null, provider: "google", createdAt: now };
}
