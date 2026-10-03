/// <reference types="@cloudflare/workers-types" />

import {
  Server,
  routePartykitRequest,
  type Connection,
  type ConnectionContext,
  type WSMessage,
} from "partyserver";
import type {
  Card,
  GamePlayer,
  GameSocketMessage,
  GameState,
  Team,
} from "../lib/gameSocket";

const PLAYER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface Env {
  Main: DurableObjectNamespace<Main>;
  APPWRITE_ENDPOINT?: string;
  APPWRITE_PROJECT_ID?: string;
  STATS_API_URL?: string;
  STATS_API_SECRET?: string;
}

type AppwriteAccount = { $id: string; name: string; email: string };

export class Main extends Server<Env> {

  async authenticate(token: string | null): Promise<AppwriteAccount | null> {
    const { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } = this.env;

    // Local PartyKit development can still run without Appwrite. Deployed
    // environments should always configure both values.
    if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID) return null;
    if (!token) throw new Error("Sign in is required");

    const response = await fetch(`${APPWRITE_ENDPOINT.replace(/\/$/, "")}/account`, {
      headers: {
        "X-Appwrite-Project": APPWRITE_PROJECT_ID,
        "X-Appwrite-JWT": token,
      },
    });

    if (!response.ok) throw new Error("Your sign-in expired. Please sign in again");
    return response.json<AppwriteAccount>();
  }

  async recordStats(game: GameState) {
    if (!this.env.STATS_API_URL || !this.env.STATS_API_SECRET || !game.matchId) return;

    const players = game.players
      .filter((player) => player.accountId)
      .map((player) => ({
        userId: player.accountId!,
        team: player.team,
      }));

    if (players.length === 0) return;

    const response = await fetch(this.env.STATS_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.env.STATS_API_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        matchId: game.matchId,
        roomCode: game.roomCode ?? "unknown",
        blueScore: game.blueScore,
        redScore: game.redScore,
        players,
      }),
    });

    if (!response.ok) throw new Error(`Stats API returned ${response.status}`);
  }

  sendMessage(
    conn: Connection,
    payload: GameSocketMessage,
  ) {
    const game = payload.game;
    conn.send(JSON.stringify({
      ...payload,
      ...(game ? {
        game: {
          ...game,
          players: game.players.map(player => ({
            ...player,
            hand: player.connId === conn.id ? player.hand : [],
            handCount: player.hand.length,
            uid: player.connId === conn.id ? player.uid : `seat-${player.seat}`,
            accountId: player.connId === conn.id ? player.accountId : undefined,
            connId: player.connId === conn.id ? player.connId : "",
          })),
        },
      } : {}),
    }));
  }

  async broadcastMessage(
    sender: Connection,
    senderInclusive: boolean,
    payload: GameSocketMessage & { game: GameState },
    persist = true,
  ) {
    if (payload.message) {
      payload.game.messageHistory.push(payload.message);
    }

    if (persist) {
      await this.ctx.storage.put("game", payload.game);
    }

    for (const conn of this.getConnections()) {
      if (senderInclusive || conn.id !== sender.id) {
        this.sendMessage(conn, payload);
      }
    }
  }

  async onConnect(
    conn: Connection,
    ctx: ConnectionContext
  ) {
    const url = new URL(ctx.request.url);

    const name = url.searchParams.get("name") ?? "Player"
    const mode = url.searchParams.get("mode");
    const playerId = url.searchParams.get("playerId");
    const authToken = url.searchParams.get("authToken");

    let game = await this.ctx.storage.get<GameState>("game");

    let account: AppwriteAccount | null;
    try {
      account = await this.authenticate(authToken);
    } catch (error) {
      this.sendMessage(conn, {
        type: "error",
        message: error instanceof Error ? error.message : "Could not verify account",
      });
      conn.close();
      return;
    }

    const verifiedName = account?.name?.trim() || name;

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
      (player) => account ? player.accountId === account.$id : player.uid === playerId,
    );

    if (game && existingPlayer) {
      existingPlayer.connId = conn.id;
      existingPlayer.name = verifiedName;
      existingPlayer.accountId = account?.$id;

      game.messageHistory.push(
        `${existingPlayer.name} reconnected`,
      );

      await this.ctx.storage.put("game", game);

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
        roomCode: url.pathname.split("/").filter(Boolean).at(-1)?.toUpperCase(),
        matchId: null,
        statsRecorded: false,
        players: [],
        phase: "lobby",
        playingState: "selecting dealer",
        dealerSeat: 0,
        turnSeat: 0,
        roundNum: 0,
        blueScore: 0,
        redScore: 0,
        trump: null,
        upCard: null,
        makerTeam: null,
        trumpCallerSeat: null,
        goingAlone: false,
        aloneSeat: null,
        trick: [],
        blueTricks: 0,
        redTricks: 0,
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
      name: verifiedName,
      accountId: account?.$id,
      seat: game.players.length as GamePlayer["seat"],
      team: game.players.length % 2 === 0 ? "blue" : "red",
      hand: [],
    };    
  
    game.players.push(player);
  
    const historyMessage =
    mode === "create"
      ? `${verifiedName} created the room`
      : `${verifiedName} joined the room`;

  game.messageHistory.push(historyMessage);

  await this.ctx.storage.put("game", game);

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

  async onMessage(sender: Connection, message: WSMessage){
    type RoundState = GameState & { biddingRound?: 1 | 2; passes?: number };
    const suits: Card["suit"][] = ["clubs", "diamonds", "hearts", "spades"];
    const ranks: Card["rank"][] = ["9", "10", "J", "Q", "K", "A"];
    const sameColor = {
      clubs: "spades", spades: "clubs", hearts: "diamonds", diamonds: "hearts",
    } as const;

    const deal = (game: RoundState) => {
      const deck: Card[] = suits.flatMap(suit =>
        ranks.map(rank => ({ id: `${suit}-${rank}`, suit, rank })),
      );
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      for (const seatedPlayer of game.players) seatedPlayer.hand = deck.splice(0, 5);
      game.phase = "playing";
      game.playingState = "ordering suit";
      game.roundNum++;
      game.turnSeat = (game.dealerSeat + 1) % 4;
      game.upCard = deck[0];
      game.trump = null;
      game.makerTeam = null;
      game.trumpCallerSeat = null;
      game.goingAlone = false;
      game.aloneSeat = null;
      game.trick = [];
      game.lastTrick = [];
      game.lastTrickWinnerSeat = null;
      game.blueTricks = 0;
      game.redTricks = 0;
      game.biddingRound = 1;
      game.passes = 0;
      game.messageHistory.push(`Hand ${game.roundNum} dealt`);
    };

    try {
      let parsed: unknown;
      try {
        if (typeof message !== "string") {
          throw new Error("Binary messages are not supported");
        }
        parsed = JSON.parse(message);
      } catch {
        throw new Error("Invalid JSON message");
      }
      const action = parsed as Record<string, unknown>;

      const game = await this.ctx.storage.transaction(async (storage) => {
        const game = (await storage.get<RoundState>("game"))!;
        const player = game.players.find(player => player.connId === sender.id)!;
        if (game.playingState === "collecting trick") {
          throw new Error("Wait for the trick to be collected");
        }

        const nextSeat = (seat: number) => {
          let next = (seat + 1) % 4;
          if (game.goingAlone && game.aloneSeat !== null && next === (game.aloneSeat + 2) % 4) {
            next = (next + 1) % 4;
          }
          return next;
        };
        const effectiveSuit = (card: Card) =>
          game.trump && card.rank === "J" && card.suit === sameColor[game.trump]
            ? game.trump : card.suit;

        if (action.type === "choose_team") {
          if (game.phase !== "lobby" || game.roundNum !== 0) {
            throw new Error("Teams can only be changed before the game starts");
          }
          if (action.team !== "blue" && action.team !== "red") {
            throw new Error("Invalid team selection");
          }

          player.team = action.team as Team;
          game.messageHistory.push(`${player.name} joined the ${player.team} team`);
        }

        if (action.type === "start_game") {
          if (game.phase !== "lobby" || game.roundNum !== 0) {
            throw new Error("The game has already started");
          }
          if (player !== game.players[0]) {
            throw new Error("Only the host can start the game");
          }
          if (game.players.length !== 4) {
            throw new Error("Four players are required to start");
          }

          const bluePlayers = game.players.filter(player => player.team === "blue");
          const redPlayers = game.players.filter(player => player.team === "red");
          if (bluePlayers.length !== 2 || redPlayers.length !== 2) {
            throw new Error("Each team needs exactly two players");
          }

          bluePlayers.forEach((player, index) => {
            player.seat = (index * 2) as GamePlayer["seat"];
          });
          redPlayers.forEach((player, index) => {
            player.seat = (index * 2 + 1) as GamePlayer["seat"];
          });
          game.roundNum = 0;
          game.matchId = crypto.randomUUID();
          game.statsRecorded = false;
          game.lastHandResult = null;
          game.blueScore = 0;
          game.redScore = 0;
          game.dealerSeat = Math.floor(Math.random() * 4);
          deal(game);
        }

        if (action.type === "order_up") {
          const dealer = game.players.find(p => p.seat === game.dealerSeat)!;
          game.trump = game.upCard!.suit;
          game.makerTeam = player.team;
          game.trumpCallerSeat = player.seat;
          game.goingAlone = action.goingAlone === true;
          game.aloneSeat = game.goingAlone ? player.seat : null;
          dealer.hand.push(game.upCard!);
          game.turnSeat = game.dealerSeat;
          game.messageHistory.push(`${player.name} ordered up ${game.trump}${game.goingAlone ? " alone" : ""}`);
        }

        if (action.type === "pass") {
          game.messageHistory.push(`${player.name} passed`);
          game.passes = (game.passes ?? 0) + 1;
          game.turnSeat = (game.turnSeat + 1) % 4;
          if (game.passes === 4) {
            if ((game.biddingRound ?? 1) === 1) {
              game.biddingRound = 2;
              game.passes = 0;
              game.messageHistory.push("Upcard turned down; choose another suit");
            } else {
              game.messageHistory.push("Everyone passed twice; redealing");
              game.dealerSeat = (game.dealerSeat + 1) % 4;
              deal(game);
            }
          }
        }

        if (action.type === "call_trump") {
          
          game.trump = action.suit as Card["suit"];
          game.makerTeam = player.team;
          game.trumpCallerSeat = player.seat;
          game.goingAlone = action.goingAlone === true;
          game.aloneSeat = game.goingAlone ? player.seat : null;
          game.upCard = null;
          game.playingState = "playing cards";
          game.turnSeat = nextSeat(game.dealerSeat);
          game.messageHistory.push(`${player.name} called ${game.trump}${game.goingAlone ? " alone" : ""}`);
        }

        if (action.type === "discard_card") {
          const index = player.hand.findIndex(card => card.id === action.cardId);
          player.hand.splice(index, 1);
          game.upCard = null;
          game.playingState = "playing cards";
          game.turnSeat = nextSeat(game.dealerSeat);
          game.messageHistory.push(`${player.name} discarded`);
        }

        if (action.type === "next_hand") {
          if (game.phase !== "playing" || game.blueTricks + game.redTricks !== 5) {
            throw new Error("The next hand starts automatically after five tricks");
          }
          game.dealerSeat = (game.dealerSeat + 1) % 4;
          deal(game);
        }

        if (action.type === "restart_game") {
          game.matchId = crypto.randomUUID();
          game.statsRecorded = false;
          game.lastHandResult = null;
          game.blueScore = 0;
          game.redScore = 0;
          game.roundNum = 0;
          game.dealerSeat = Math.floor(Math.random() * 4);
          game.messageHistory.push(`${player.name} restarted the game`);
          deal(game);
        }

        if (action.type === "play_card") {
          if (!player || game.phase !== "playing" || game.playingState !== "playing cards" || !game.trump || !game.makerTeam) {
            throw new Error("Cards cannot be played now");
          }
          if (player.seat !== game.turnSeat) {
            throw new Error("It is not your turn");
          }
          if (game.goingAlone && game.aloneSeat !== null && player.seat === (game.aloneSeat + 2) % 4) {
            throw new Error("Your partner is playing alone");
          }
          const index = player.hand.findIndex(card => card.id === action.cardId);
          if (index === -1) {
            throw new Error("That card is not in your hand");
          }
          const card = player.hand[index];
          if (game.trick.length > 0) {
            const leadSuit = effectiveSuit(game.trick[0].card);
            if (effectiveSuit(card) !== leadSuit && player.hand.some(c => effectiveSuit(c) === leadSuit)) {
              throw new Error("You must follow suit");
            }
          }
          player.hand.splice(index, 1);
          game.trick.push({ playerSeat: player.seat, card });
          game.messageHistory.push(`${player.name} played ${card.rank} of ${card.suit}`);
          game.turnSeat = nextSeat(player.seat);

          if (game.trick.length === (game.goingAlone ? 3 : 4)) {
            const leadSuit = effectiveSuit(game.trick[0].card);
            const strength = (card: Card) => {
              const suit = effectiveSuit(card);
              if (suit === game.trump) {
                if (card.rank === "J") return card.suit === game.trump ? 100 : 99;
                return 50 + ranks.indexOf(card.rank);
              }
              return suit === leadSuit ? 10 + ranks.indexOf(card.rank) : 0;
            };
            const winningPlay = game.trick.reduce((best, play) =>
              strength(play.card) > strength(best.card) ? play : best,
            );
            const winner = game.players.find(p => p.seat === winningPlay.playerSeat)!;
            if (winner.team === "blue") game.blueTricks++; else game.redTricks++;
            game.turnSeat = -1;
            game.playingState = "collecting trick";
            game.lastTrick = game.trick;
            game.lastTrickWinnerSeat = winner.seat;
            game.messageHistory.push(`${winner.name} won the trick`);

            if (game.blueTricks + game.redTricks === 5) {
              const makerTricks = game.makerTeam === "blue" ? game.blueTricks : game.redTricks;
              const scoringTeam = makerTricks >= 3 ? game.makerTeam : game.makerTeam === "blue" ? "red" : "blue";
              const points = makerTricks < 3 ? 2 : makerTricks === 5 ? (game.goingAlone ? 4 : 2) : 1;
              game.lastHandResult = {
                roundNum: game.roundNum,
                team: scoringTeam,
                points,
                blueTricks: game.blueTricks,
                redTricks: game.redTricks,
              };
              if (scoringTeam === "blue") game.blueScore += points; else game.redScore += points;
              game.messageHistory.push(`${scoringTeam} scored ${points} point${points === 1 ? "" : "s"}`);

            }
          }
        }

        await storage.put("game", game);
        return game;
      });

      await this.broadcastMessage(sender, true, { type: "state", game }, false);
      if (game.playingState === "collecting trick") {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const nextGame = await this.ctx.storage.transaction(async (storage) => {
          const current = await storage.get<RoundState>("game");
          if (!current || current.playingState !== "collecting trick" || current.roundNum !== game.roundNum) return;
          current.trick = [];
          current.playingState = "playing cards";
          current.turnSeat = current.lastTrickWinnerSeat!;
          if (current.blueTricks + current.redTricks === 5) {
            if (current.blueScore >= 10 || current.redScore >= 10) {
              current.phase = "finished";
              current.messageHistory.push(`${current.blueScore >= 10 ? "blue" : "red"} won the game`);
            } else {
              current.dealerSeat = (current.dealerSeat + 1) % 4;
              deal(current);
            }
          }
          await storage.put("game", current);
          return current;
        });
        if (nextGame) {
          if (nextGame.phase === "finished" && !nextGame.statsRecorded) {
            try {
              await this.recordStats(nextGame);
              nextGame.statsRecorded = true;
              await this.ctx.storage.put("game", nextGame);
            } catch (error) {
              console.error("Could not record match stats", error);
            }
          }
          await this.broadcastMessage(sender, true, { type: "state", game: nextGame }, false);
        }
      }
    } catch (error) {
      const game = await this.ctx.storage.get<GameState>("game");
      this.sendMessage(sender, {
        type: "error",
        message: error instanceof Error ? error.message : "Could not process action",
        ...(game?.players.some(player => player.connId === sender.id) ? { game } : {}),
      });
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env)) ??
      new Response("Not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
