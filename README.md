This is euchre made in NextJS with partykit. The server is /party/index.ts. All client and server interactions are handled through GameSocketContext.tsx. gameSocket.ts provides types and a couple helper functions. NEXT_PUBLIC_PARTYKIT_HOST="localhost:1999" in env

for one machine:
run the client with npm run dev
run the server with npx partykit dev

for multiple machines:
start server on ngrok, set env variable to that server, start nextjs app on ngrok, share with friends!

npx partykit dev
ngrok http 1999 --traffic-policy-file policy.yml
set env to the ngrok 
npm run dev
ngrok http 3000 --traffic-policy-file policy.yml


