import PartySocket from "partysocket";

export type GamePlayer = {
  connId: string;
  uid: string;
  name: string;

  seat: 0 | 1 | 2 | 3;
  team: Team;

  hand: Card[];
  handCount?: number;
};

export type Team = "blue" | "red";

export type GameState = {
  players: GamePlayer[];

  phase: "lobby" | "playing" | "finished";

  playingState:
    | "selecting dealer"
    | "dealing"
    | "ordering suit"
    | "playing cards"
    | "collecting trick";

  dealerSeat: number;
  turnSeat: number;

  roundNum: number;
  biddingRound?: 1 | 2;

  blueScore: number;
  redScore: number;

  trump: Suit | null;
  upCard: Card | null;

  makerTeam: Team | null;
  trumpCallerSeat: number | null;

  goingAlone: boolean;
  aloneSeat: number | null;

  trick: PlayedCard[];
  lastTrick?: PlayedCard[];
  lastTrickWinnerSeat?: number | null;
  lastHandResult?: {
    roundNum: number;
    team: Team;
    points: number;
    blueTricks: number;
    redTricks: number;
  } | null;
  blueTricks: number;
  redTricks: number;

  messageHistory: string[];
};

export type Suit =
  | "clubs"
  | "diamonds"
  | "hearts"
  | "spades";

export type Rank =
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K"
  | "A";

export type Card = {
  id: string;
  suit: Suit;
  rank: Rank;
};

export type PlayedCard = {
  playerSeat: number;
  card: Card;
};

export type GameSocketMessage = {
  type: string;
  message?: string;
  game?: GameState;
  [key: string]: unknown;
};

const PARTYKIT_HOST = "localhost:1999";
const PLAYER_ID_STORAGE_KEY = "euchre.playerId";
const PLAYER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getOrCreatePlayerId() {
  const playerId = crypto.randomUUID();

  try {
    const storedPlayerId = window.localStorage.getItem(PLAYER_ID_STORAGE_KEY);

    if (storedPlayerId && PLAYER_ID_PATTERN.test(storedPlayerId)) {
      return storedPlayerId;
    }

    window.localStorage.setItem(PLAYER_ID_STORAGE_KEY, playerId);
  } catch {
    
  }

  return playerId;
}

function generateRoomCode(){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
}

export function parseGameSocketMessage(data: unknown): GameSocketMessage {
  const text = String(data);

  try {
    const message: unknown = JSON.parse(text);

    if (
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      typeof message.type === "string"
    ) {
      return message as GameSocketMessage;
    }
  } catch {
  }

  return { type: "message", message: text };
}

export function connectToGame(roomCode: string, playerName: string, mode="join"){
  try { 
    const playerId = getOrCreatePlayerId();
    const socket = new PartySocket({
    host: PARTYKIT_HOST,
    room: roomCode.toUpperCase(),
    query: {
      name: playerName,
      mode: mode,
      playerId,
    }
  })

  console.log(`${playerName} started joining room ${roomCode.toUpperCase()}`)
  return socket;
} catch (error) {
  if (error instanceof Error) {
    console.error(error.message); 
  } else {
    console.error("An unexpected error occurred", error);
  }
}

}

export function createRoom(playerName: string){
  const roomCode = generateRoomCode();
  const socket = connectToGame(roomCode, playerName, "create");

  return {roomCode, socket};
}

export function joinRoom(roomCode: string, playerName: string){
  const socket = connectToGame(
    roomCode.trim().toUpperCase(),
    playerName
  );

  return socket;
}
