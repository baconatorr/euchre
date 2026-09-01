"use client";

import { useGameSocket } from "@/context/GameSocketContext";
import type { GameState } from "@/lib/gameSocket";
import { use } from "react";
import PlayerIcon from "../../../components/PlayerIcon"
import GameLog from "@/components/GameLog";

function destructureGameState(game?: GameState): {
  players: GameState["players"];
  phase: GameState["phase"] | null;
  messageHistory: GameState["messageHistory"];
} {
  const {
    players = [],
    phase = null,
    messageHistory = [],
  } = game ?? {};

  return { players, phase, messageHistory };
}


export default function Page({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const { roomCode } = use(params);

  const {
    roomCode: connectedRoomCode,
    status,
    lastMessage,
  } = useGameSocket();

  const isCurrentRoom = connectedRoomCode === roomCode;
  const { players, phase, messageHistory } = destructureGameState(
    lastMessage?.game,
  );

  if (phase === "lobby") {
    return (
      <main>
        <h1>room: {roomCode}</h1>

        <p>Connection: {isCurrentRoom ? status : "disconnected"}</p>

        {!isCurrentRoom && (
          <p>
            There is no active connection to this room. Join from the home page.
          </p>
        )}

      <div>
        <div>
          {players
            .filter((player) => player.seat % 2 === 0)
            .map((player) => (
              <PlayerIcon
                key={player.uid}
                name={player.name}
                seat={player.seat}
              />
            ))}
        </div>

        <div>
          {players
            .filter((player) => player.seat % 2 !== 0)
            .map((player) => (
              <PlayerIcon
                key={player.uid}
                name={player.name}
                seat={player.seat}
              />
            ))}
        </div>
      </div>

        {isCurrentRoom && <GameLog messages={messageHistory} />}
      </main>
    );
  }

  if (phase === "playing") {
    return (
      <main>
        <p>time to play!</p>
        {isCurrentRoom && <GameLog messages={messageHistory} />}
      </main>
    );
  }
}
