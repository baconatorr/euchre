import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

const host = "127.0.0.1";
const port = 1998;
const wrangler = fileURLToPath(
  new URL(
    `../node_modules/.bin/${process.platform === "win32" ? "wrangler.cmd" : "wrangler"}`,
    import.meta.url,
  ),
);

const server = spawn(
  wrangler,
  ["dev", "--ip", host, "--port", String(port)],
  {
    env: { ...process.env, NO_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  },
);

let serverOutput = "";

server.stdout.on("data", (chunk) => {
  serverOutput += String(chunk);
});
server.stderr.on("data", (chunk) => {
  serverOutput += String(chunk);
});

function waitForServer() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Wrangler did not start in time.\n${serverOutput}`));
    }, 15_000);

    const check = () => {
      if (serverOutput.includes(`Ready on http://${host}:${port}`)) {
        clearTimeout(timeout);
        resolve();
      }
    };

    server.stdout.on("data", check);
    server.stderr.on("data", check);
    server.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Wrangler exited with code ${code}.\n${serverOutput}`));
    });
  });
}

function connect(room, name, mode) {
  return new Promise((resolve, reject) => {
    const url = new URL(
      `ws://${host}:${port}/parties/main/${room}`,
    );
    url.searchParams.set("name", name);
    url.searchParams.set("mode", mode);
    url.searchParams.set("playerId", crypto.randomUUID());
    url.searchParams.set("_pk", crypto.randomUUID());

    const socket = new WebSocket(url);
    const expectedType = mode === "create" ? "created" : "joined";
    const timeout = setTimeout(() => {
      reject(new Error(`${name} did not receive a ${expectedType} response`));
    }, 5_000);

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));

      if (message.type === expectedType) {
        clearTimeout(timeout);
        resolve({ message, socket });
      } else if (message.type === "error") {
        clearTimeout(timeout);
        reject(new Error(`${name}: ${message.message}`));
      }
    });

    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error(`${name} could not connect`));
    });
  });
}

try {
  await waitForServer();

  const room = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  const alice = await connect(room, "Alice", "create");
  const bob = await connect(room, "Bob", "join");
  const playerNames = bob.message.game?.players.map((player) => player.name);

  if (playerNames?.join(",") !== "Alice,Bob") {
    throw new Error(`Unexpected room state: ${JSON.stringify(bob.message)}`);
  }

  alice.socket.close();
  bob.socket.close();

  console.log(`PartyServer smoke test passed for room ${room}: Alice, Bob`);
} finally {
  server.kill();
  await Promise.race([
    once(server, "exit"),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
}
