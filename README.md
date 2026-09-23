# Euchre

This is a Next.js Euchre game with a Cloudflare PartyServer backend. The realtime server is in `party/index.ts`. Client/server interactions are handled through `context/GameSocketContext.tsx`, while `lib/gameSocket.ts` contains the shared types and socket helpers.

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
