This is euchre made in NextJS with partykit. The server is /party/index.ts. All client and server interactions are handled through GameSocketContext.tsx. gameSocket.ts provides types and a couple helper functions.

run the client with npm run dev
run the server with npx partykit dev and set NEXT_PUBLIC_PARTYKIT_HOST="localhost:1999" in an env