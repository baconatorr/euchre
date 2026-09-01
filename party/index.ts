import type * as Party from "partykit/server";
import type * as Euchre from "../lib/euchre"

type Player = {
  id: string;
  name: string;
  seat: number;
  hand: Euchre.Card[];
}

type GameState = {
  players: Player[];
  phase: "lobby" | "playing" | "finished";
};

export default class Server implements Party.Server {
  
  sendMessage(conn: Party.Connection, type: string, message?: string){
    conn.send(JSON.stringify({
      type,
      message,
    }))
  }
  constructor(readonly room: Party.Room){
  }

  async onConnect(
    conn: Party.Connection,
    ctx: Party.ConnectionContext
  ) {
    const url = new URL(ctx.request.url);
    const name = url.searchParams.get("name") ?? "Player"
    const mode = url.searchParams.get("mode");

    if (mode !== "create" && mode !== "join") {
      this.sendMessage(conn, "error", "Invalid connection mode");
      conn.close();
      return;
    }

    let game = await this.room.storage.get<GameState>("game");

    if (mode === "create") {
      if (game) {
        this.sendMessage(conn, "error", "Room code already exists");
        conn.close();
        return;
      }
      game = {
        players: [],
        phase: "lobby",
      };
      this.sendMessage(conn, "created");
    }  

    if (mode === "join") {
      if (!game) {
        this.sendMessage(conn, "error", "Room not found");
        conn.close()
        return;
      }
      if(game.players.length >= 4){
        this.sendMessage(conn, "error", "Room is full");
        conn.close();
        return;
      }
      this.sendMessage(conn, "joined");
    }
    

    const player: Player = {
      id: conn.id,
      name,
      seat: game?.players.length ?? 0,
      hand: [],
    };
  
    if (game) {
      game.players.push(player);
    }
  
    await this.room.storage.put("game", game);
  }
}
