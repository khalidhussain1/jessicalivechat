# Jessica Chat

Live customer care chat for gamers. Customers sign in with Google, email/password,
or as a guest; a password-protected agent inbox lets a support team reply in
real time (via polling), with typing indicators, sound alerts, and image
uploads on both sides. Every reply shows to the customer as "Jessica"
regardless of which agent actually sent it.

- **Customer chat**: `/support`
- **Agent inbox**: `/agent`

## Stack

- Next.js (App Router) + Tailwind v4
- Postgres via [Neon](https://neon.tech) (`@neondatabase/serverless`)
- [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) for uploaded images
- [Auth.js](https://authjs.dev) for customer login (Google + credentials)
- Stateless signed-JWT cookies for agent sessions (`jose`)
- PWA (installable to a phone home screen) with a manual "Add to phone" prompt

Realtime updates are done by short client-side polling (every ~2s), not
WebSockets/SSE — chosen so this runs correctly on Vercel's serverless
functions without needing a separate realtime service.

## Local development

```bash
npm install
vercel env pull   # pulls DATABASE_URL, BLOB_STORE_ID, etc. from the linked Vercel project
npm run dev -- -p 3005
```

Required env vars (see `.env.local`, gitignored):

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (Neon) |
| `BLOB_STORE_ID` | Vercel Blob store (image uploads) |
| `AUTH_SECRET` | Auth.js session signing |
| `AGENT_SESSION_SECRET` | Agent login session signing |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Optional — enables "Continue with Google" |

## Agents

Two default agent accounts are seeded automatically on first login attempt:

| Username | Password | Name |
| --- | --- | --- |
| `agent1` | `agent1pass` | Agent 1 |
| `agent2` | `agent2pass` | Agent 2 |

Add another agent:

```bash
node --env-file=.env.local scripts/create-agent.mjs "Agent 3" agent3 aStrongPassword
```

## Deploy

Connected to Vercel — pushing to `main` deploys to production automatically.
