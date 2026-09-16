"use client";

import { useGameSocket } from "@/context/GameSocketContext";
import type { Card, GameState, Suit } from "@/lib/gameSocket";
import { use, useEffect, useRef, useState, type CSSProperties } from "react";
import PlayerIcon from "../../../components/PlayerIcon"
import PlayingCard from "@/components/PlayingCard";

function destructureGameState(game?: Partial<GameState>): {
  players: GameState["players"];
  phase: GameState["phase"] | null;
  playingState: GameState["playingState"] | null;
  dealerSeat: number;
  turnSeat: number;
  roundNum: number;
  blueScore: number;
  redScore: number;
  trump: GameState["trump"];
  upCard: GameState["upCard"];
  makerTeam: GameState["makerTeam"];
  trumpCallerSeat: number | null;
  goingAlone: boolean;
  aloneSeat: number | null;
  trick: GameState["trick"];
  blueTricks: number;
  redTricks: number;
  messageHistory: GameState["messageHistory"];
} {
  const {
    players = [],
    phase = null,
    playingState = null,
    dealerSeat = 0,
    turnSeat = 0,
    roundNum = 1,
    blueScore = 0,
    redScore = 0,
    trump = null,
    upCard = null,
    makerTeam = null,
    trumpCallerSeat = null,
    goingAlone = false,
    aloneSeat = null,
    trick = [],
    blueTricks = 0,
    redTricks = 0,
    messageHistory = [],
  } = game ?? {};

  return {
    players,
    phase,
    playingState,
    dealerSeat,
    turnSeat,
    roundNum,
    blueScore,
    redScore,
    trump,
    upCard,
    makerTeam,
    trumpCallerSeat,
    goingAlone,
    aloneSeat,
    trick,
    blueTricks,
    redTricks,
    messageHistory,
  };
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
    joinGame,
    startGame,
    orderUp,
    pass,
    callTrump,
    discardCard,
    playCard,
    restartGame,
  } = useGameSocket();
  
  const attemptedReconnect = useRef(false);
  const [startRequest, setStartRequest] = useState<{ message: typeof lastMessage } | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [bidAlone, setBidAlone] = useState(false);
  const [actionRequest, setActionRequest] = useState<{ message: typeof lastMessage } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  
  useEffect(() => {
    if (attemptedReconnect.current) return;

    if (connectedRoomCode === roomCode) return;
  
    const playerName = sessionStorage.getItem("playerName");
  
    if (!playerName) {
      return;
    }
  
    attemptedReconnect.current = true;
  
    joinGame(roomCode, playerName).catch((error) => {
      console.error("Failed to reconnect:", error);
    });
  }, [roomCode, connectedRoomCode, joinGame]);

  const isCurrentRoom = connectedRoomCode === roomCode;
  const { players,
    phase,
    playingState,
    dealerSeat,
    turnSeat,
    roundNum,
    blueScore,
    redScore,
    trump,
    upCard,
    makerTeam,
    trumpCallerSeat,
    goingAlone,
    aloneSeat,
    trick,
    blueTricks,
    redTricks,
    messageHistory, } = destructureGameState(
    lastMessage?.game,
  );

  const currentPlayer = isCurrentRoom
    ? players.find((player) => Boolean(player.connId))
    : undefined;

  const getDisplaySeat = (seat: number) =>
    currentPlayer ? (seat - currentPlayer.seat + 6) % 4 : seat;

  const isStarting = startRequest !== null && startRequest.message === lastMessage;
  const canStart = currentPlayer?.seat === 0 && players.length === 4 && status === "connected";

  const handleStartGame = () => {
    if (!canStart || isStarting) return;

    try {
      setStartError(null);
      startGame();
      setStartRequest({ message: lastMessage });
    } catch (error) {
      setStartError(error instanceof Error ? error.message : "Could not start game");
    }
  };

  const startControls = roundNum === 0 && playingState === "selecting dealer" ? (
    <div className="flex flex-col items-center gap-3 px-4 text-center">
      {players.length < 4 ? (
        <p className="text-sm">Waiting for players ({players.length}/4)</p>
      ) : currentPlayer?.seat === 0 ? (
        <button
          type="button"
          onClick={handleStartGame}
          disabled={!canStart || isStarting}
          className="rounded-xl bg-white px-6 py-3 font-bold text-green-900 shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isStarting ? "Starting..." : "Start Game"}
        </button>
      ) : (
        <p className="text-sm">Waiting for the room creator to start the game.</p>
      )}
      {status !== "connected" && <p className="text-sm">Waiting for connection...</p>}
      {(startError || lastMessage?.type === "error") && (
        <p className="text-sm text-red-200">
          {startError ?? lastMessage?.message ?? "Could not start game"}
        </p>
      )}
    </div>
  ) : null;

  const biddingRound = lastMessage?.game?.biddingRound ?? 1;
  const isOrdering = phase === "playing" && playingState === "ordering suit";
  const waitingForDiscard = isOrdering && trump !== null;
  const isMyTurn = currentPlayer?.seat === turnSeat;
  const turnPlayer = players.find(player => player.seat === turnSeat);
  const dealer = players.find(player => player.seat === dealerSeat);
  const actionPending = actionRequest !== null && actionRequest.message === lastMessage;
  const canBid = isOrdering && !trump && isMyTurn && status === "connected" && !actionPending;
  const canDiscard = waitingForDiscard && isMyTurn && currentPlayer?.seat === dealerSeat
    && status === "connected" && !actionPending;
  const suitLabels: Record<Suit, string> = {
    clubs: "♣ Clubs", diamonds: "♦ Diamonds", hearts: "♥ Hearts", spades: "♠ Spades",
  };

  const sendGameAction = (action: () => void) => {
    try {
      setActionError(null);
      action();
      setActionRequest({ message: lastMessage });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not send action");
    }
  };

  const isPlayingCards = phase === "playing" && playingState === "playing cards";
  const sittingOut = goingAlone && aloneSeat !== null && currentPlayer?.seat === (aloneSeat + 2) % 4;
  const effectiveSuit = (card: Card) => {
    const sameColor: Record<Suit, Suit> = {
      clubs: "spades", spades: "clubs", hearts: "diamonds", diamonds: "hearts",
    };
    return trump && card.rank === "J" && card.suit === sameColor[trump] ? trump : card.suit;
  };

  const canPlayCard = (card: Card) => {
    if (!isPlayingCards || !isMyTurn || sittingOut || status !== "connected" || actionPending) return false;
    if (!trick.length) return true;
    const leadSuit = effectiveSuit(trick[0].card);
    return effectiveSuit(card) === leadSuit || !currentPlayer?.hand.some(c => effectiveSuit(c) === leadSuit);
  };
  
  const handleCardClick = (card: Card) => {
    if (waitingForDiscard && canDiscard) sendGameAction(() => discardCard(card.id));
    else if (canPlayCard(card)) sendGameAction(() => playCard(card.id));
  };
  const displayedTrick = trick;
  const lastTrickWinner = players.find(player => player.seat === lastMessage?.game?.lastTrickWinnerSeat);
  const isCollectingTrick = playingState === "collecting trick";
  const winnerPosition = lastTrickWinner ? getDisplaySeat(lastTrickWinner.seat) : 0;
  const trickAnimationStyle = {
    "--trick-x": winnerPosition === 1 ? "clamp(70px,20vw,220px)" : winnerPosition === 3 ? "clamp(-220px,-20vw,-70px)" : "0px",
    "--trick-y": winnerPosition === 0 ? "calc(var(--table-height) * -0.35)" : winnerPosition === 2 ? "calc(var(--table-height) * 0.4)" : "0px",
  } as CSSProperties;

  const biddingControls = isOrdering ? (
    <section className="flex w-full min-w-0 flex-col items-center gap-2 rounded-xl border border-white/10 bg-green-950/90 p-3 text-center text-sm shadow-lg sm:gap-3">
      <p className="max-w-full break-words font-medium">
        {waitingForDiscard
          ? currentPlayer?.seat === dealerSeat
            ? "Choose one card from your hand to discard."
            : `Waiting for ${dealer?.name ?? "the dealer"} to discard.`
          : isMyTurn
            ? biddingRound === 1 ? "Your turn to order up or pass." : "Your turn to choose trump or pass."
            : `${turnPlayer?.name ?? "The next player"}'s turn to ${biddingRound === 1 ? "order up" : "choose trump"}.`}
      </p>
      {!waitingForDiscard && (
        <>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center">
            {biddingRound === 1 ? (
              <button
                type="button"
                disabled={!canBid}
                onClick={() => { if (canBid && upCard) sendGameAction(() => orderUp(bidAlone)); }}
                className="min-h-11 rounded-lg bg-white px-3 py-2 text-sm font-bold text-green-950 sm:px-4 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
              >
                Order Up{upCard ? ` ${suitLabels[upCard.suit]}` : ""}
              </button>
            ) : (
              (Object.keys(suitLabels) as Suit[]).filter(suit => suit !== upCard?.suit).map(suit => (
                <button
                  key={suit}
                  type="button"
                  disabled={!canBid}
                  onClick={() => { if (canBid) sendGameAction(() => callTrump(suit, bidAlone)); }}
                  className="min-h-11 rounded-lg bg-white px-3 py-2 text-sm font-bold text-green-950 sm:px-4 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                >
                  {suitLabels[suit]}
                </button>
              ))
            )}
            <button
              type="button"
              disabled={!canBid || (currentPlayer?.seat === dealerSeat && biddingRound != 1)}
              onClick={() => { if (canBid) sendGameAction(pass); }}
              className="min-h-11 rounded-lg bg-white px-3 py-2 text-sm font-bold text-green-950 sm:px-4 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
            >
              Pass
            </button>
          </div>
          <label className={`flex min-h-9 items-center gap-2 text-sm ${!canBid ? "text-gray-300" : ""}`}>
            <input type="checkbox" className="h-4 w-4" checked={bidAlone} disabled={!canBid} onChange={event => setBidAlone(event.target.checked)} />
            Go alone
          </label>
        </>
      )}
      {actionPending && <p className="text-sm">Sending...</p>}
      {status !== "connected" && <p className="text-sm">Waiting for connection...</p>}
      {(actionError || lastMessage?.type === "error") && (
        <p className="text-sm text-red-200">{actionError ?? lastMessage?.message ?? "Could not send action"}</p>
      )}
    </section>
  ) : null;

  if (!phase) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-green-600 text-white">
        <p>Loading game...</p>
      </main>
    );
  }

  if (phase === "lobby") {
    return (
      <main className="flex min-h-svh flex-col bg-green-600 px-3 py-3 text-white sm:px-5 sm:py-4 lg:px-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
          <h1 className="text-xl font-bold sm:text-2xl">
            Room: {roomCode}
          </h1>

          <p className="text-sm">
            Connection: {isCurrentRoom ? status : "disconnected"}
          </p>
        </div>

        {!isCurrentRoom && (
          <p className="mb-4 rounded-lg bg-red-900/40 px-4 py-3">
            There is no active connection to this room. Join from the home page.
          </p>
        )}

        <div className="flex flex-1 items-center justify-center">
          <div className="relative my-4 h-[clamp(300px,65svh,520px)] w-full max-w-4xl sm:my-6">
            <div className="absolute inset-x-8 inset-y-14 rounded-[3rem] border-[6px] border-emerald-800 bg-green-700 sm:inset-x-16 sm:inset-y-20 sm:rounded-[4rem] sm:border-8 lg:inset-x-20">
              <div className="flex h-full flex-col items-center justify-center gap-6">
                <div className="whitespace-nowrap text-3xl sm:text-4xl lg:text-5xl">
                  ♠ <span className="text-red-300">♥</span> ♣{" "}
                  <span className="text-red-300">♦</span>
                </div>
                {startControls}
              </div>
            </div>

            <div className="absolute left-1/2 top-0 -translate-x-1/2">
              {players
                .filter((player) => getDisplaySeat(player.seat) === 0)
                .map((player) => (
                  <PlayerIcon
                    key={player.uid}
                    name={player.name}
                    seat={player.seat}
                    isDealer={roundNum > 0 && player.seat === dealerSeat}
                  />
                ))}
            </div>

            <div className="absolute right-0 top-1/2 -translate-y-1/2">
              {players
                .filter((player) => getDisplaySeat(player.seat) === 1)
                .map((player) => (
                  <PlayerIcon
                    key={player.uid}
                    name={player.name}
                    seat={player.seat}
                    isDealer={roundNum > 0 && player.seat === dealerSeat}
                  />
                ))}
            </div>

            <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
              {players
                .filter((player) => getDisplaySeat(player.seat) === 2)
                .map((player) => (
                  <PlayerIcon
                    key={player.uid}
                    name={player.name}
                    seat={player.seat}
                    isDealer={roundNum > 0 && player.seat === dealerSeat}
                  />
                ))}
            </div>

            <div className="absolute left-0 top-1/2 -translate-y-1/2">
              {players
                .filter((player) => getDisplaySeat(player.seat) === 3)
                .map((player) => (
                  <PlayerIcon
                    key={player.uid}
                    name={player.name}
                    seat={player.seat}
                    isDealer={roundNum > 0 && player.seat === dealerSeat}
                  />
                ))}
            </div>
          </div>
        </div>

      </main>
    );

  }

  if (phase === "playing" || phase === "finished") {
    return (
      <main className="flex min-h-svh flex-col bg-green-600 px-3 py-3 text-white sm:px-5 sm:py-4 lg:px-8">
        <details className="mx-auto mb-2 w-full max-w-4xl rounded-md bg-black/15 px-3 py-2 text-xs sm:text-sm">
          <summary className="cursor-pointer">dev log</summary>
          <p>time to play!</p>
          <p>phase: {phase}</p>
          <p>playing state: {playingState}</p>
          <p>dealer seat: {dealerSeat}</p>
          <p>turn seat: {turnSeat}</p>
          <p>round num: {roundNum}</p>
          <p>blue score: {blueScore}</p>
          <p>red score: {redScore}</p>
          <p>trump: {trump}</p>
          <p>up card: {upCard ? upCard.toString() : "No card"}</p>
          <p>maker team: {makerTeam}</p>
          <p>trump caller seat: {trumpCallerSeat}</p>
          <p>going alone: {goingAlone}</p>
          <p>alone seat: {aloneSeat}</p>
          <p>
            {trick.map((card, index) => (
              <span key={index}>{card.toString()}</span>
            ))}
          </p>
          <p>{blueTricks}</p>
          <p>{redTricks}</p>
          <p>{messageHistory}</p>
        </details>
        {roundNum > 0 && (
          <section className="mx-auto mb-3 px-4 py-2 text-green-950 sm:px-5 sm:py-3">
            <div className="flex items-center gap-x-3 gap-y-1 text-center tabular-nums sm:gap-x-4">
              <span className="text-left text-xs text-white">Tricks</span>
              <span className="text-xl font-bold text-blue-600">{blueTricks}</span>
              <span className="text-white">–</span>
              <span className="text-xl font-bold text-red-600">{redTricks}</span>
              <span className="text-left text-xs text-white">Game</span>
              <span className="text-xl font-bold text-blue-600 sm:text-xl">{blueScore}</span>
              <span className="text-white">–</span>
              <span className="text-xl font-bold text-red-600 sm:text-xl">{redScore}</span>
            </div>
          </section>
        )}
        {isCollectingTrick && (
          <p className="mx-auto mb-3 w-full max-w-lg break-words text-center text-sm sm:text-base">{lastTrickWinner?.name} won the trick.</p>
        )}
        {isPlayingCards && (
          <div className="mx-auto mb-3 w-full max-w-lg break-words text-center text-sm sm:text-base">
            <p>
              {sittingOut ? "Your partner is playing alone."
                : isMyTurn ? "Your turn. Choose a card to play."
                  : `Waiting for ${turnPlayer?.name ?? "the next player"} to play.`}
            </p>
            {actionPending && <p className="text-sm">Sending...</p>}
            {status !== "connected" && <p className="text-sm">Waiting for connection...</p>}
            {(actionError || lastMessage?.type === "error") && (
              <p className="text-sm text-red-200">{actionError ?? lastMessage?.message}</p>
            )}
          </div>
        )}
        {phase === "finished" && (
          <section className="mx-auto mb-3 w-full max-w-lg break-words text-center text-sm sm:text-base">
            <h1 className="text-xl font-bold sm:text-2xl">{blueScore >= 10 ? "Blue" : "Red"} wins!</h1>
            {currentPlayer?.seat === 0 && (
              <button type="button" disabled={status !== "connected" || actionPending}
                onClick={() => sendGameAction(restartGame)}
                className="mt-3 rounded-lg bg-white px-4 py-2 font-bold text-green-950 disabled:opacity-50">
                Play Again
              </button>
            )}
            {(actionError || lastMessage?.type === "error") && <p>{actionError ?? lastMessage?.message}</p>}
          </section>
        )}
  
        <div className="flex flex-1 items-center justify-center">
          <div className="relative grid w-full max-w-4xl grid-rows-[var(--table-height)_auto] gap-y-3 [--table-height:clamp(280px,42svh,360px)] sm:gap-y-4 sm:[--table-height:clamp(320px,44svh,440px)] lg:[--table-height:clamp(320px,46svh,480px)]">
            <div className="absolute inset-x-7 top-14 h-[calc(var(--table-height)-4.5rem)] rounded-[3rem] border-[6px] border-emerald-800 bg-green-700 sm:inset-x-14 sm:top-16 sm:h-[calc(var(--table-height)-5rem)] sm:rounded-[4rem] sm:border-8 lg:inset-x-20">
              <div className="flex h-full flex-col items-center justify-center gap-6">
                {(isPlayingCards || isCollectingTrick || phase === "finished") && displayedTrick.length > 0 ? (
                  <div
                    className={`flex flex-col items-center gap-2 ${isCollectingTrick ? "animate-collect-trick" : ""}`}
                    style={trickAnimationStyle}
                  >
                    <p className="text-center text-xs font-medium">
                      {isCollectingTrick ? `${lastTrickWinner?.name ?? "Player"} wins` : "Current trick"}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {displayedTrick.map(play => (
                        <div key={play.playerSeat} className="flex w-12 flex-col items-center gap-1">
                          <PlayingCard card={play.card} compact />
                          <span className="w-full truncate text-center text-xs">{players.find(player => player.seat === play.playerSeat)?.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : upCard && !trump ? (
                  <div className="flex flex-col items-center gap-2">
                    <PlayingCard
                      card={biddingRound === 2 ? undefined : upCard}
                    />
                    <p className="text-sm font-medium">
                      {biddingRound === 2 ? "Turned down" : "Upcard"}
                    </p>
                  </div>
                ) : (
                  <div className="whitespace-nowrap text-3xl sm:text-4xl lg:text-5xl">
                    ♠ <span className="text-red-300">♥</span> ♣{" "}
                    <span className="text-red-300">♦</span>
                  </div>
                )}
                {startControls}
              </div>
            </div>
  
            <div className="absolute left-1/2 top-0 -translate-x-1/2">
              {players
                .filter((player) => getDisplaySeat(player.seat) === 0)
                .map((player) => (
                  <div key={player.uid} className="flex min-w-0 flex-col items-center gap-2 sm:gap-3">
                    <div className={player.seat === currentPlayer?.seat ? "order-2" : ""}>
                      <PlayerIcon
                        name={player.name}
                        seat={player.seat}
                        isDealer={roundNum > 0 && player.seat === dealerSeat}
                      />
                    </div>
                    {roundNum > 0 && (
                      <div
                        className={`flex justify-center ${player.seat === currentPlayer?.seat ? "-space-x-1 sm:space-x-1" : "-space-x-5 sm:-space-x-6 lg:-space-x-7"}`}
                      >
                        {player.seat === currentPlayer?.seat
                          ? player.hand.map(card => waitingForDiscard || isPlayingCards || isCollectingTrick ? (
                            <button
                              key={card.id}
                              type="button"
                              disabled={waitingForDiscard ? !canDiscard : !canPlayCard(card)}
                              onClick={() => handleCardClick(card)}
                              className="shrink-0 rounded-md transition-transform enabled:hover:z-10 enabled:hover:-translate-y-1 sm:enabled:hover:-translate-y-2 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <PlayingCard card={card} />
                            </button>
                          ) : <PlayingCard key={card.id} card={card} />)
                          : Array.from({ length: player.handCount ?? 0 }, (_, index) => (
                            <PlayingCard key={index} compact />
                          ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
  
            <div className="absolute right-0 top-[calc(var(--table-height)/2)] -translate-y-1/2">
              {players
                .filter((player) => getDisplaySeat(player.seat) === 1)
                .map((player) => (
                  <div key={player.uid} className="flex min-w-0 flex-col items-center gap-2 sm:gap-3">
                    <div className={player.seat === currentPlayer?.seat ? "order-2" : ""}>
                      <PlayerIcon
                        name={player.name}
                        seat={player.seat}
                        isDealer={roundNum > 0 && player.seat === dealerSeat}
                      />
                    </div>
                    {roundNum > 0 && (
                      <div
                        className={`flex justify-center ${player.seat === currentPlayer?.seat ? "-space-x-1 sm:space-x-1" : "-space-x-5 sm:-space-x-6 lg:-space-x-7"}`}
                      >
                        {player.seat === currentPlayer?.seat
                          ? player.hand.map(card => waitingForDiscard || isPlayingCards || isCollectingTrick ? (
                            <button
                              key={card.id}
                              type="button"
                              disabled={waitingForDiscard ? !canDiscard : !canPlayCard(card)}
                              onClick={() => handleCardClick(card)}
                              className="shrink-0 rounded-md transition-transform enabled:hover:z-10 enabled:hover:-translate-y-1 sm:enabled:hover:-translate-y-2 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <PlayingCard card={card} />
                            </button>
                          ) : <PlayingCard key={card.id} card={card} />)
                          : Array.from({ length: player.handCount ?? 0 }, (_, index) => (
                            <PlayingCard key={index} compact />
                          ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
  
            <div className="relative row-start-2 flex w-full min-w-0 max-w-lg flex-col items-center gap-3 justify-self-center pb-2 sm:gap-4">
              {biddingControls}
              {players
                .filter((player) => getDisplaySeat(player.seat) === 2)
                .map((player) => (
                  <div key={player.uid} className="flex min-w-0 flex-col items-center gap-2 sm:gap-3">
                    <div className={player.seat === currentPlayer?.seat ? "order-2" : ""}>
                      <PlayerIcon
                        name={player.name}
                        seat={player.seat}
                        isDealer={roundNum > 0 && player.seat === dealerSeat}
                      />
                    </div>
                    {roundNum > 0 && (
                      <div
                        className={`flex justify-center ${player.seat === currentPlayer?.seat ? "-space-x-1 sm:space-x-1" : "-space-x-5 sm:-space-x-6 lg:-space-x-7"}`}
                      >
                        {player.seat === currentPlayer?.seat
                          ? player.hand.map(card => waitingForDiscard || isPlayingCards || isCollectingTrick ? (
                            <button
                              key={card.id}
                              type="button"
                              disabled={waitingForDiscard ? !canDiscard : !canPlayCard(card)}
                              onClick={() => handleCardClick(card)}
                              className="shrink-0 rounded-md transition-transform enabled:hover:z-10 enabled:hover:-translate-y-1 sm:enabled:hover:-translate-y-2 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <PlayingCard card={card} />
                            </button>
                          ) : <PlayingCard key={card.id} card={card} />)
                          : Array.from({ length: player.handCount ?? 0 }, (_, index) => (
                            <PlayingCard key={index} compact />
                          ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
  
            <div className="absolute left-0 top-[calc(var(--table-height)/2)] -translate-y-1/2">
              {players
                .filter((player) => getDisplaySeat(player.seat) === 3)
                .map((player) => (
                  <div key={player.uid} className="flex min-w-0 flex-col items-center gap-2 sm:gap-3">
                    <div className={player.seat === currentPlayer?.seat ? "order-2" : ""}>
                      <PlayerIcon
                        name={player.name}
                        seat={player.seat}
                        isDealer={roundNum > 0 && player.seat === dealerSeat}
                      />
                    </div>
                    {roundNum > 0 && (
                      <div
                        className={`flex justify-center ${player.seat === currentPlayer?.seat ? "-space-x-1 sm:space-x-1" : "-space-x-5 sm:-space-x-6 lg:-space-x-7"}`}
                      >
                        {player.seat === currentPlayer?.seat
                          ? player.hand.map(card => waitingForDiscard || isPlayingCards || isCollectingTrick ? (
                            <button
                              key={card.id}
                              type="button"
                              disabled={waitingForDiscard ? !canDiscard : !canPlayCard(card)}
                              onClick={() => handleCardClick(card)}
                              className="shrink-0 rounded-md transition-transform enabled:hover:z-10 enabled:hover:-translate-y-1 sm:enabled:hover:-translate-y-2 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <PlayingCard card={card} />
                            </button>
                          ) : <PlayingCard key={card.id} card={card} />)
                          : Array.from({ length: player.handCount ?? 0 }, (_, index) => (
                            <PlayingCard key={index} compact />
                          ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
  
      </main>
    );
  }

  return(<h1>not found</h1>);
}
