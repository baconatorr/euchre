import type * as Party from "partykit/server";
import type {
  GamePlayer,
  GameSocketMessage,
  GameState,
} from "../lib/gameSocket";

const PLAYER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default class Server implements Party.Server {
  constructor(readonly room: Party.Room){
  }

  sendMessage(
    conn: Party.Connection,
    payload: GameSocketMessage,
  ) {
    conn.send(JSON.stringify(payload));
  }

  async broadcastMessage(
    sender: Party.Connection,
    senderInclusive: boolean,
    payload: GameSocketMessage & { game: GameState },
  ) {
    if (payload.message) {
      payload.game.messageHistory.push(payload.message);
    }

    await this.room.storage.put("game", payload.game);

    const serialized = JSON.stringify(payload);

    if (senderInclusive) {
      this.room.broadcast(serialized);
    } else {
      this.room.broadcast(serialized, [sender.id]);
    }
  }

  async onConnect(
    conn: Party.Connection,
    ctx: Party.ConnectionContext
  ) {
    const url = new URL(ctx.request.url);

    const name = url.searchParams.get("name") ?? "Player"
    const mode = url.searchParams.get("mode");
    const playerId = url.searchParams.get("playerId");

    let game = await this.room.storage.get<GameState>("game");

    if (mode !== "create" && mode !== "join") {
      this.sendMessage(
        conn,
        {
          type: "error",
          game,
          message: "Invalid connection mode",
        },
      );

      conn.close();
      return;
    }

    if (!playerId || !PLAYER_ID_PATTERN.test(playerId)) {
      this.sendMessage(
        conn,
        {
          type: "error",
          game,
          message: "Invalid player ID",
        },
      );

      conn.close();
      return;
    }

    const existingPlayer = game?.players.find(
      (player) => player.uid === playerId,
    );

    if (game && existingPlayer) {
      existingPlayer.connId = conn.id;
      existingPlayer.name = name;

      game.messageHistory.push(
        `${existingPlayer.name} reconnected`,
      );

      await this.room.storage.put("game", game);

      this.sendMessage(
        conn,
        {
          type: mode === "create" ? "created" : "joined",
          game,
        },
      );

      await this.broadcastMessage(
        conn,
        true,
        {
          type: "state",
          game,
          message: `${existingPlayer.name} reconnected`,
        },
      );

      return;
    }

    if (mode === "create") {
      if (game) {
        this.sendMessage(
          conn,
          {
            type: "error",
            game,
            message: "Room code already exists",
          },
        );
        conn.close();
        return;
      }
      game = {
        players: [],
        phase: "lobby",
        messageHistory: [],
      };
      this.sendMessage(conn, { type: "created" });
    }  

    if (mode === "join") {
      if (!game) {
        this.sendMessage(
          conn,
          {
            type: "error",
            message: "Room not found",
          },
        );
        conn.close()
        return;
      }
      if(game.players.length >= 4){
        this.sendMessage(
          conn,
          {
            type: "error",
            game,
            message: "Room is full",
          },
        );
        conn.close();
        return;
      }
    }

    if (!game) {
      this.sendMessage(
        conn,
        {
          type: "error",
          message: "Failed to initialize game",
        },
      );

      conn.close();
      return;
    }

    const player: GamePlayer = {
      connId: conn.id,
      uid: playerId,
      name,
      seat: game?.players.length ?? 0,
      hand: [],
    };
  
    game.players.push(player);
    if(game.players.length == 4){
      game.phase = "playing"
    }
  
    const historyMessage =
    mode === "create"
      ? `${name} created the room`
      : `${name} joined the room`;

  game.messageHistory.push(historyMessage);

  await this.room.storage.put("game", game);

  this.sendMessage(
    conn,
    {
      type: mode === "create" ? "created" : "joined",
      game,
      message: historyMessage,
    },
  );

  await this.broadcastMessage(
    conn,
    true,
    {
      type: "state",
      game,
    },
  );
  }
}
