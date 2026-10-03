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

function sendAction(socket, action, isExpectedState = () => true) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`No state received for ${action.type}`));
    }, 5_000);

    const onMessage = (event) => {
      const message = JSON.parse(String(event.data));

      if (message.type === "state" && isExpectedState(message.game)) {
        clearTimeout(timeout);
        socket.removeEventListener("message", onMessage);
        resolve(message);
      } else if (message.type === "error") {
        clearTimeout(timeout);
        socket.removeEventListener("message", onMessage);
        reject(new Error(message.message));
      }
    };

    socket.addEventListener("message", onMessage);
    socket.send(JSON.stringify(action));
  });
}

try {
  await waitForServer();

  const room = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  const alice = await connect(room, "Alice", "create");
  const bob = await connect(room, "Bob", "join");
  const charlie = await connect(room, "Charlie", "join");
  const dana = await connect(room, "Dana", "join");
  const playerNames = dana.message.game?.players.map((player) => player.name);

  if (playerNames?.join(",") !== "Alice,Bob,Charlie,Dana") {
    throw new Error(`Unexpected room state: ${JSON.stringify(dana.message)}`);
  }

  await sendAction(
    alice.socket,
    { type: "choose_team", team: "red" },
    (game) => game.players.find((player) => player.name === "Alice")?.team === "red",
  );
  await sendAction(
    bob.socket,
    { type: "choose_team", team: "blue" },
    (game) => game.players.find((player) => player.name === "Bob")?.team === "blue",
  );
  const started = await sendAction(
    alice.socket,
    { type: "start_game" },
    (game) => game.phase === "playing" && game.roundNum === 1,
  );
  const seats = Object.fromEntries(
    started.game.players.map((player) => [player.name, player.seat]),
  );

  if (
    started.game.phase !== "playing" ||
    seats.Alice !== 1 ||
    seats.Bob !== 0 ||
    seats.Charlie !== 2 ||
    seats.Dana !== 3
  ) {
    throw new Error(`Unexpected selected teams: ${JSON.stringify(started.game)}`);
  }

  alice.socket.close();
  bob.socket.close();
  charlie.socket.close();
  dana.socket.close();

  console.log(`PartyServer smoke test passed for room ${room}: team selection and deal`);
} finally {
  server.kill();
  await Promise.race([
    once(server, "exit"),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
}
