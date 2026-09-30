// Usage: node --env-file=.env.local scripts/create-agent.mjs "Agent 3" agent3 somePassword123
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const [, , name, username, password] = process.argv;

if (!name || !username || !password) {
  console.error(
    "Usage: node --env-file=.env.local scripts/create-agent.mjs <name> <username> <password>",
  );
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run with: node --env-file=.env.local scripts/create-agent.mjs ...");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const passwordHash = bcrypt.hashSync(password, 10);

await sql`
  INSERT INTO agents (id, name, username, password_hash, created_at)
  VALUES (${randomUUID()}, ${name}, ${username.toLowerCase()}, ${passwordHash}, ${Date.now()})
  ON CONFLICT (username) DO NOTHING
`;

console.log(`Created agent "${name}" with username "${username.toLowerCase()}"`);
