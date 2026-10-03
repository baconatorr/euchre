"use client";

import { useGameSocket } from "@/context/GameSocketContext";
import { useAuth } from "@/context/AuthContext";
import type { Card, GameState, Suit } from "@/lib/gameSocket";
import GameLog from "@/components/GameLog";
import Link from "next/link";
import { use, useEffect, useRef, useState, type CSSProperties } from "react";
import PlayerIcon from "../../../components/PlayerIcon";
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
  const { refreshStats } = useAuth();

  const {
    roomCode: connectedRoomCode,
    status,
    lastMessage,
    joinGame,
    chooseTeam,
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

  useEffect(() => {
    if (phase === "finished") {
      void refreshStats().catch(() => undefined);
    }
  }, [phase, refreshStats]);

  const getDisplaySeat = (seat: number) =>
    currentPlayer ? (seat - currentPlayer.seat + 6) % 4 : seat;

  const bluePlayers = players.filter((player) => player.team === "blue");
  const redPlayers = players.filter((player) => player.team === "red");
  const teamsAreReady = bluePlayers.length === 2 && redPlayers.length === 2;
  const isHost = Boolean(currentPlayer && currentPlayer.uid === players[0]?.uid);
  const isStarting = startRequest !== null && startRequest.message === lastMessage;
  const canStart = isHost && players.length === 4 && teamsAreReady && status === "connected";

  const gameHeader = (
    <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-3 sm:pb-4">
      <div className="flex items-center gap-3">
        <Link href="/" aria-label="Back to home" className="grid h-9 w-9 place-items-center rounded-lg bg-[#81b64c] font-black text-white shadow-[0_3px_0_#5d8735] hover:bg-[#8fc357]">
          E
        </Link>
        <h1 className="text-lg font-extrabold tracking-wide text-white sm:text-xl">Room {roomCode}</h1>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-[#312e2b] px-3 py-2 text-xs font-semibold text-[#d8d7d5]">
        <span className={`h-2 w-2 rounded-full ${isCurrentRoom && status === "connected" ? "bg-[#81b64c] shadow-[0_0_8px_rgba(129,182,76,.75)]" : "bg-[#e06c64]"}`} />
        {isCurrentRoom && status === "connected" ? "Live table" : "Reconnecting"}
      </div>
    </header>
  );

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
    <div className="flex w-full max-w-md flex-col items-center gap-3 px-4 text-center">
      <div className="grid w-full grid-cols-2 gap-3">
        {(["blue", "red"] as const).map((team) => {
          const teamPlayers = team === "blue" ? bluePlayers : redPlayers;
          const isSelected = currentPlayer?.team === team;
          const isBlue = team === "blue";

          return (
            <button
              key={team}
              type="button"
              onClick={() => chooseTeam(team)}
              disabled={status !== "connected" || isSelected || isStarting}
              aria-pressed={isSelected}
              className={`rounded-xl border px-3 py-3 text-left transition disabled:cursor-default ${
                isSelected
                  ? isBlue
                    ? "border-[#71a7d8] bg-[#31506d] ring-2 ring-[#71a7d8]/35"
                    : "border-[#df756e] bg-[#693b38] ring-2 ring-[#df756e]/35"
                  : "border-white/12 bg-[#312e2b]/85 hover:border-white/30 hover:bg-[#3b3835]"
              }`}
            >
              <span className={`text-sm font-bold ${isBlue ? "text-[#9bc8ee]" : "text-[#f3aaa5]"}`}>
                {isBlue ? "Blue" : "Red"} team · {teamPlayers.length}/2
              </span>
              <span className="mt-1 block min-h-8 text-xs leading-4 text-[#d8d7d5]">
                {teamPlayers.map((player) => player.name).join(", ") || "Choose this team"}
              </span>
            </button>
          );
        })}
      </div>
      {players.length < 4 ? (
        <>
          <p className="text-lg font-bold text-white">Waiting for the table</p>
          <p className="text-sm text-[#d4dfcf]">{players.length} of 4 players have joined</p>
        </>
      ) : isHost ? (
        <>
          <button
            type="button"
            onClick={handleStartGame}
            disabled={!canStart || isStarting}
            className="primary-action min-h-12 rounded-lg px-7 py-3 font-extrabold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isStarting ? "Starting…" : "Start game"}
          </button>
          {!teamsAreReady && (
            <p className="text-sm text-[#f0c95a]">Each team needs exactly two players.</p>
          )}
        </>
      ) : (
        <p className="text-sm text-[#d4dfcf]">
          {teamsAreReady ? "Teams are set. Waiting for the host to deal." : "Choose teams with two players on each side."}
        </p>
      )}
      {status !== "connected" && <p className="text-sm text-[#f0c95a]">Reconnecting…</p>}
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
    <section className="surface-panel flex w-full min-w-0 flex-col items-center gap-3 rounded-xl p-4 text-center text-sm sm:p-5">
      <p className="max-w-full break-words font-semibold text-[#f1f1ef]">
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
                className="primary-action min-h-11 rounded-lg px-3 py-2 text-sm font-bold sm:px-4 disabled:cursor-not-allowed disabled:opacity-45"
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
                  className="min-h-11 rounded-lg border border-white/10 bg-[#454341] px-3 py-2 text-sm font-bold text-white hover:bg-[#504e4b] sm:px-4 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {suitLabels[suit]}
                </button>
              ))
            )}
            <button
              type="button"
              disabled={!canBid || (currentPlayer?.seat === dealerSeat && biddingRound != 1)}
              onClick={() => { if (canBid) sendGameAction(pass); }}
              className="min-h-11 rounded-lg border border-white/10 bg-[#454341] px-3 py-2 text-sm font-bold text-white hover:bg-[#504e4b] sm:px-4 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Pass
            </button>
          </div>
          <label className={`flex min-h-9 items-center gap-2 text-sm text-[#d8d7d5] ${!canBid ? "opacity-45" : ""}`}>
            <input type="checkbox" className="h-4 w-4 accent-[#81b64c]" checked={bidAlone} disabled={!canBid} onChange={event => setBidAlone(event.target.checked)} />
            Go alone
          </label>
        </>
      )}
      {actionPending && <p className="text-sm text-[#b7b5b2]">Sending…</p>}
      {status !== "connected" && <p className="text-sm text-[#f0c95a]">Reconnecting…</p>}
      {(actionError || lastMessage?.type === "error") && (
        <p className="text-sm text-red-200">{actionError ?? lastMessage?.message ?? "Could not send action"}</p>
      )}
    </section>
  ) : null;

  if (!phase) {
    return (
      <main className="app-shell flex min-h-svh items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-white/15 border-t-[#81b64c]" />
          <p className="font-semibold text-[#b7b5b2]">Pulling up your chair…</p>
        </div>
      </main>
    );
  }

  if (phase === "lobby") {
    return (
      <main className="app-shell flex min-h-svh flex-col px-3 py-3 text-white sm:px-5 sm:py-4 lg:px-8">
        {gameHeader}

        {!isCurrentRoom && (
          <p className="mx-auto mt-4 w-full max-w-6xl rounded-lg border border-[#e06c64]/30 bg-[#4b2928] px-4 py-3 text-[#ffc2bc]">
            There is no active connection to this room. Join from the home page.
          </p>
        )}

        <div className="flex flex-1 items-center justify-center py-4 sm:py-6">
          <div className="relative h-[clamp(320px,70svh,560px)] w-full max-w-4xl">
            <div className="game-table absolute inset-x-8 inset-y-14 rounded-[3rem] sm:inset-x-16 sm:inset-y-20 sm:rounded-[4rem] lg:inset-x-20">
              <div className="flex h-full flex-col items-center justify-center gap-6">
                <div className="text-center">
                  <div className="whitespace-nowrap text-3xl font-black tracking-[0.18em] text-white/90 sm:text-4xl lg:text-5xl">
                    ♠ <span className="text-[#f09a94]">♥</span> ♣ <span className="text-[#f09a94]">♦</span>
                  </div>
                  <p className="mt-3 text-sm font-medium text-white/55">Invite your partners</p>
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
                    team={player.team}
                    isDealer={roundNum > 0 && player.seat === dealerSeat}
                    isActive={roundNum > 0 && player.seat === turnSeat}
                    isCurrent={player.seat === currentPlayer?.seat}
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
                    team={player.team}
                    isDealer={roundNum > 0 && player.seat === dealerSeat}
                    isActive={roundNum > 0 && player.seat === turnSeat}
                    isCurrent={player.seat === currentPlayer?.seat}
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
                    team={player.team}
                    isDealer={roundNum > 0 && player.seat === dealerSeat}
                    isActive={roundNum > 0 && player.seat === turnSeat}
                    isCurrent={player.seat === currentPlayer?.seat}
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
                    team={player.team}
                    isDealer={roundNum > 0 && player.seat === dealerSeat}
                    isActive={roundNum > 0 && player.seat === turnSeat}
                    isCurrent={player.seat === currentPlayer?.seat}
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
      <main className="app-shell flex min-h-svh flex-col px-3 py-3 text-white sm:px-5 sm:py-4 lg:px-8">
        {gameHeader}
        {roundNum > 0 && (
          <section className="surface-panel mx-auto mt-3 flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 sm:px-5">
            <div className="min-w-28">
              <p className="font-bold text-white">
                Hand {roundNum} · {trump ? <>Trump <span className={trump === "diamonds" || trump === "hearts" ? "text-[#f09a94]" : "text-[#d8d7d5]"}>{suitLabels[trump]}</span></> : "Calling trump"}
              </p>
            </div>
            <div className="flex items-center gap-5 text-center tabular-nums sm:gap-7">
              <div>
                <p className="text-xs font-semibold text-[#71a7d8]">Blue</p>
                <p className="text-2xl font-black text-white">{blueScore}</p>
              </div>
              <div className="text-[#777471]">
                <p className="text-xs font-semibold">Tricks</p>
                <p className="text-sm font-bold text-[#d8d7d5]">{blueTricks}–{redTricks}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#df756e]">Red</p>
                <p className="text-2xl font-black text-white">{redScore}</p>
              </div>
            </div>
            <p className="hidden min-w-28 text-right text-xs font-semibold text-[#b7b5b2] sm:block">{makerTeam ? `${makerTeam[0].toUpperCase()}${makerTeam.slice(1)} called it` : "First to 10"}</p>
          </section>
        )}
        {isCollectingTrick && (
          <p className="mx-auto mt-3 w-full max-w-lg break-words text-center text-sm font-semibold text-[#b9dd86] sm:text-base">{lastTrickWinner?.name} won the trick.</p>
        )}
        {isPlayingCards && (
          <div className="mx-auto mt-3 w-full max-w-lg break-words text-center text-sm text-[#d8d7d5] sm:text-base">
            <p>
              {sittingOut ? "Your partner is playing alone."
                : isMyTurn ? "Your turn. Choose a card to play."
                  : `Waiting for ${turnPlayer?.name ?? "the next player"} to play.`}
            </p>
            {actionPending && <p className="text-sm">Sending…</p>}
            {status !== "connected" && <p className="text-sm text-[#f0c95a]">Reconnecting…</p>}
            {(actionError || lastMessage?.type === "error") && (
              <p className="text-sm text-red-200">{actionError ?? lastMessage?.message}</p>
            )}
          </div>
        )}
        {phase === "finished" && (
          <section className="mx-auto mb-3 w-full max-w-lg break-words text-center text-sm sm:text-base">
            <h1 className="text-xl font-bold sm:text-2xl">{blueScore >= 10 ? "Blue" : "Red"} wins!</h1>
            {isHost && (
              <button type="button" disabled={status !== "connected" || actionPending}
                onClick={() => sendGameAction(restartGame)}
                className="mt-3 rounded-lg bg-white px-4 py-2 font-bold text-green-950 disabled:opacity-50">
                Play Again
              </button>
            )}
            {(actionError || lastMessage?.type === "error") && <p>{actionError ?? lastMessage?.message}</p>}
          </section>
        )}
  
        <div className="flex flex-1 items-center justify-center py-3">
          <div className="relative grid w-full max-w-4xl grid-rows-[var(--table-height)_auto] gap-y-3 [--table-height:clamp(300px,44svh,380px)] sm:gap-y-4 sm:[--table-height:clamp(340px,46svh,460px)] lg:[--table-height:clamp(360px,48svh,500px)]">
            <div className="game-table absolute inset-x-7 top-14 h-[calc(var(--table-height)-4.5rem)] rounded-[3rem] sm:inset-x-14 sm:top-16 sm:h-[calc(var(--table-height)-5rem)] sm:rounded-[4rem] lg:inset-x-20">
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
                  <div className="whitespace-nowrap text-3xl font-black tracking-[0.16em] text-white/80 sm:text-4xl lg:text-5xl">
                    ♠ <span className="text-[#f09a94]">♥</span> ♣{" "}
                    <span className="text-[#f09a94]">♦</span>
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
                        team={player.team}
                        isDealer={roundNum > 0 && player.seat === dealerSeat}
                        isActive={player.seat === turnSeat}
                        isCurrent={player.seat === currentPlayer?.seat}
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
                        team={player.team}
                        isDealer={roundNum > 0 && player.seat === dealerSeat}
                        isActive={player.seat === turnSeat}
                        isCurrent={player.seat === currentPlayer?.seat}
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
                        team={player.team}
                        isDealer={roundNum > 0 && player.seat === dealerSeat}
                        isActive={player.seat === turnSeat}
                        isCurrent={player.seat === currentPlayer?.seat}
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
                        team={player.team}
                        isDealer={roundNum > 0 && player.seat === dealerSeat}
                        isActive={player.seat === turnSeat}
                        isCurrent={player.seat === currentPlayer?.seat}
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
        <GameLog messages={messageHistory} />
      </main>
    );
  }

  return(<h1>not found</h1>);
}
