# Euchre

This is a Next.js Euchre game with a Cloudflare PartyServer backend. The realtime server is in `party/index.ts`. Client/server interactions are handled through `context/GameSocketContext.tsx`, while `lib/gameSocket.ts` contains the shared types and socket helpers.

Appwrite owns accounts and persistent match statistics. PartyKit remains the source of truth for rooms, cards, turns, scores, and all other live game state. PartyKit verifies each player with a short-lived Appwrite JWT and sends a signed result to the Next.js stats endpoint when a game reaches 10 points.

## Appwrite setup

1. Create an Appwrite project and add the web app's hostname as a Web platform.
2. Enable email/password authentication.
3. Create a database and a `game_results` collection with document security enabled.
4. Add these collection attributes:

| Attribute | Type | Size / required |
| --- | --- | --- |
| `userId` | string | 36, required |
| `matchId` | string | 36, required |
| `roomCode` | string | 16, required |
| `team` | enum | `blue`, `red`; required |
| `won` | boolean | required |
| `teamScore` | integer | required |
| `opponentScore` | integer | required |
| `playedAt` | datetime | required |

Add a key index on `userId`. Create an API key with `documents.read` and `documents.write` scopes. Copy `.env.example` to `.env.local` and fill in the Appwrite IDs, endpoint, API key, and a long random `PARTYKIT_STATS_SECRET`. Do not expose the API key or shared secret through `NEXT_PUBLIC_` variables.

Configure matching PartyKit Worker values:

```sh
npx wrangler secret put STATS_API_SECRET
npx wrangler secret put APPWRITE_PROJECT_ID
```

For local development, place the following in `.dev.vars`; for deployment, configure them as Worker variables/secrets:

```dotenv
APPWRITE_ENDPOINT=https://<REGION>.cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=<project-id>
STATS_API_URL=https://<your-next-app>/api/stats
STATS_API_SECRET=<same-value-as-PARTYKIT_STATS_SECRET>
```

## Local development

Use two terminals:

```sh
npm run party:dev
npm run dev
```

The client defaults to `localhost:1999`, which is Wrangler's local port. Override it with `NEXT_PUBLIC_PARTYKIT_HOST` when the PartyServer Worker is hosted elsewhere.

Run the PartyServer WebSocket smoke test with:

```sh
npm run party:test
```

## Deploy the realtime server

Authenticate with Cloudflare once, then deploy with Wrangler:

```sh
npx wrangler login
npm run party:deploy
```

After deployment, set `NEXT_PUBLIC_PARTYKIT_HOST` for the Next.js app to the Worker hostname, without a protocol. For example:

```dotenv
NEXT_PUBLIC_PARTYKIT_HOST=euchre-party.<your-subdomain>.workers.dev
```

Rebuild and redeploy the Next.js app after changing this public environment variable.

For testing across multiple local devices, expose ports 1999 and 3000 through your preferred tunnel and point `NEXT_PUBLIC_PARTYKIT_HOST` at the PartyServer tunnel hostname.
