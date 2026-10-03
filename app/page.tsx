"use client";

import { useGameSocket } from "@/context/GameSocketContext";
import { useAuth } from "@/context/AuthContext";
import AccountPanel from "@/components/AccountPanel";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const router = useRouter();
  const { createGame, joinGame } = useGameSocket();
  const { user } = useAuth();
  const playerName = user?.name.trim() || user?.email.split("@")[0] || "";

  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const joinSubmit = async () => {
    if (!user) {
      setError("Sign in before joining a table.");
      return;
    }

    try {
      setError(null);
      const roomCode = await joinGame(joinCode, playerName);
      router.push(`/game/${roomCode}`);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not join room"
      );
    }
  };

  const createSubmit = async () => {
    if (!user) {
      setError("Sign in before creating a table.");
      return;
    }

    try {
      setError(null);
      const roomCode = await createGame(playerName);
      router.push(`/game/${roomCode}`);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not create room"
      );
    }
  };

  return (
    <main className="app-shell min-h-svh overflow-hidden px-4 py-5 sm:px-7 sm:py-6">
      <div className="mx-auto flex min-h-[calc(100svh-2.5rem)] w-full max-w-6xl flex-col sm:min-h-[calc(100svh-3rem)]">
        <header className="flex items-center justify-between border-b border-white/8 pb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#81b64c] text-xl font-black text-white shadow-[0_3px_0_#5d8735]">
              E
            </div>
            <p className="font-henny-penny text-2xl leading-none text-white">Euchre</p>
          </div>
          <div className="hidden items-center gap-2 text-sm text-[#b7b5b2] sm:flex">
            <span className="h-2 w-2 rounded-full bg-[#81b64c] shadow-[0_0_10px_rgba(129,182,76,.7)]" />
            {user ? `Signed in as ${playerName}` : "Account required"}
          </div>
        </header>

        <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:py-14">
          <div className="mx-auto w-full max-w-xl lg:mx-0">
            <div className="mb-5 flex items-center gap-2 text-lg font-bold tracking-[0.35em]" aria-hidden="true">
              <span className="text-[#d8d7d5]">♠</span>
              <span className="text-[#e06c64]">♥</span>
              <span className="text-[#d8d7d5]">♣</span>
              <span className="text-[#e06c64]">♦</span>
            </div>
            <h1 className="max-w-lg text-balance text-5xl font-black leading-[0.98] tracking-[-0.045em] text-[#f1f1ef] sm:text-6xl lg:text-7xl">
              The table&apos;s ready.
              <span className="block text-[#81b64c]">Deal one more.</span>
            </h1>
            <p className="mt-6 max-w-md text-pretty text-base leading-7 text-[#b7b5b2] sm:text-lg">
              Open a private room, send your friends the code, and get straight to the cards.
            </p>

            <div className="relative mt-10 hidden h-64 max-w-xl lg:block" aria-hidden="true">
              <div className="game-table absolute inset-x-2 inset-y-3 rounded-[4.5rem]">
                <div className="absolute inset-0 grid place-items-center">
                  <div className="flex -space-x-5 -rotate-2">
                    {["J", "Q", "K", "A"].map((rank, index) => (
                      <div
                        key={rank}
                        className={`grid h-28 w-20 place-items-center rounded-lg border-2 border-[#dedbd2] bg-[#f5f3eb] text-3xl font-black shadow-xl ${index % 2 ? "text-[#b94843]" : "text-[#292725]"}`}
                        style={{ transform: `rotate(${(index - 1.5) * 6}deg) translateY(${Math.abs(index - 1.5) * 5}px)` }}
                      >
                        {rank}
                      </div>
                    ))}
                  </div>
                </div>
                {["top-[-14px] left-1/2 -translate-x-1/2", "right-[-14px] top-1/2 -translate-y-1/2", "bottom-[-14px] left-1/2 -translate-x-1/2", "left-[-14px] top-1/2 -translate-y-1/2"].map((position, index) => (
                  <span key={position} className={`absolute ${position} grid h-10 w-10 place-items-center rounded-full border-2 border-[#676461] bg-[#3a3836] text-xs font-bold shadow-lg`}>
                    {index + 1}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <section className="surface-panel mx-auto w-full max-w-md rounded-2xl p-5 sm:p-7" aria-labelledby="seat-heading">
            <div className="mb-6">
              <h2 id="seat-heading" className="text-3xl font-bold tracking-tight text-white">Take a seat</h2>
              <p className="mt-1 text-sm text-[#9d9b98]">Choose a table name your friends will recognize.</p>
            </div>

            <div className="flex flex-col gap-5">
              <AccountPanel />

              <button
                type="button"
                onClick={createSubmit}
                disabled={!user}
                className="primary-action min-h-13 rounded-lg px-5 text-base font-extrabold disabled:cursor-not-allowed disabled:opacity-45"
              >
                Create a private table
              </button>

              <div className="flex items-center gap-3 text-xs font-semibold text-[#777471]">
                <span className="h-px flex-1 bg-white/8" />
                or join one
                <span className="h-px flex-1 bg-white/8" />
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="flex flex-col gap-2 text-sm font-semibold text-[#d8d7d5]">
                  Room code
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                    placeholder="ABCDE"
                    maxLength={5}
                    autoComplete="off"
                    className="min-h-13 w-full rounded-lg border border-white/10 bg-[#262522] px-4 text-base font-bold uppercase tracking-[0.18em] text-white shadow-inner outline-none placeholder:tracking-[0.18em] placeholder:text-[#777471] focus:border-[#81b64c]"
                  />
                </label>
                <button
                  type="button"
                  onClick={joinSubmit}
                  disabled={!user || joinCode.trim().length !== 5}
                  className="min-h-13 self-end rounded-lg border border-white/10 bg-[#454341] px-5 font-bold text-white shadow-[0_3px_0_#242321] hover:bg-[#504e4b] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Join table
                </button>
              </div>

              {error && (
                <div role="alert" className="rounded-lg border border-[#e06c64]/30 bg-[#4b2928] px-4 py-3 text-sm font-medium text-[#ffc2bc]">
                  {error}
                </div>
              )}
            </div>
          </section>
        </section>

        <footer className="flex items-center justify-between border-t border-white/8 pt-4 text-xs text-[#777471]">
          <span>Four players. Two teams.</span>
          <span className="font-bold tracking-[0.22em]">♣ EUCHRE ♦</span>
        </footer>
      </div>
    </main>
  );
}
