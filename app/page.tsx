"use client";

import { useGameSocket } from "@/context/GameSocketContext";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useState } from "react";

const cardSuits = ["♠", "♥", "♣", "♦"];

export default function Home() {
  const router = useRouter();
  const { createGame, joinGame } = useGameSocket();

  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function checkUsername() {
    const profanitySet = new Set<string>([]);

    if (name.trim().length < 3) {
      return false;
    }

    if (profanitySet.has(name.toLowerCase())) {
      setName("i tried to make my name a bad word but it didnt work");
    }

    return true;
  }

  const joinSubmit = async () => {
    if (!checkUsername()) {
      setError("Username must be at least 3 characters.");
      return;
    }

    try {
      setError(null);
      const roomCode = await joinGame(joinCode, name);
      router.push(`/game/${roomCode}`);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not join room"
      );
    }
  };

  const createSubmit = async () => {
    if (!checkUsername()) {
      setError("Username must be at least 3 characters.");
      return;
    }

    try {
      setError(null);
      const roomCode = await createGame(name);
      router.push(`/game/${roomCode}`);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not create room"
      );
    }
  };

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-green-600 px-4">
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {Array.from({ length: 24 }, (_, index) => {
          const suit = cardSuits[index % cardSuits.length];

          const style = {
            left: `${(index * 37 + 7) % 101}%`,
            fontSize: `${1.7 + (index % 5) * 0.55}rem`,
            animationDelay: `${-(index * 1.45)}s`,
            animationDuration: `${9 + (index % 7) * 1.35}s`,
            "--suit-drift": `${((index % 3) - 1) * 70}px`,
            "--suit-spin": `${index % 2 === 0 ? 360 : -360}deg`,
          } as CSSProperties;

          return (
            <span
              key={index}
              style={style}
              className={`absolute top-[-15vh] animate-suit-fall leading-none opacity-0
                [text-shadow:0_2px_2px_rgb(0_0_0_/_12%)]
                will-change-[transform,opacity]
                motion-reduce:translate-y-[50vh]
                motion-reduce:animate-none
                motion-reduce:opacity-100
                ${
                  suit === "♥" || suit === "♦"
                    ? "text-red-900/60"
                    : "text-green-950/45"
                }
              `}
            >
              {suit}
            </span>
          );
        })}
      </div>

      <section className="relative z-10 w-full max-w-md rounded-3xl  sm:p-9">
        <div className="mb-8 text-center">
          <div className="mb-2 text-3xl">
            <span className="text-white">♠</span>
            <span className="text-red-300"> ♥ </span>
            <span className="text-white">♣</span>
            <span className="text-red-300"> ♦</span>
          </div>

          <h1 className="font-henny-penny text-6xl font-bold text-white drop-shadow-lg sm:text-7xl">
            Euchre!
          </h1>

          <p className="mt-2 text-sm font-medium text-green-50/80">
            Create a table or join your friends.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">

            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter username"
                className="w-full rounded-xl border border-white/20 bg-white px-4 py-3 pr-11 text-black shadow-sm outline-none placeholder:text-gray-400 focus:border-white focus:ring-4 focus:ring-white/20"
              />

              <span
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xl text-red-700"
              >
                ♥
              </span>
            </div>
          </label>

          <button
            type="button"
            onClick={createSubmit}
            className="relative rounded-xl bg-white px-5 py-3 font-bold text-green-900 shadow-lg"
          >
            Create Game

            <span
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xl"
            >
              ♣
            </span>
          </button>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Join code"
                className="w-full rounded-xl border border-white/20 bg-white px-4 py-3 pr-11 font-semibold uppercase text-black shadow-sm outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-gray-400 focus:border-white focus:ring-4 focus:ring-white/20"
              />

              <span
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xl text-red-700"
              >
                ♦
              </span>
            </div>

            <button
              type="button"
              onClick={joinSubmit}
              className="rounded-xl bg-green-950/80 px-5 py-3 font-bold text-white shadow-lg"
            >
              Join Game
            </button>
          </div>

          {error && (
            <div
              className="rounded-xl border border-red-200/40 bg-red-950/40 px-4 py-3 text-sm font-medium text-red-50"
            >
              {error}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
