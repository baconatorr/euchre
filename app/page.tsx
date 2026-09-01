"use client"
import { joinRoom, createRoom } from "@/lib/gameSocket";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useState } from "react";

const cardSuits = ["♠", "♥", "♣", "♦"];

export default function Home() {
  const router = useRouter();

  const [name, setName] = useState("")
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null)

  function checkUsername(){
    const profanitySet = new Set<String>([])
    if(name.length < 3){
      return false
    }
    if(profanitySet.has(name)){
      setName("i tried to make my name a bad word but i didnt work")
    }
    return true;
  }

  function listenForResult(
    socket: ReturnType<typeof joinRoom>,
    roomCode: string
  ){
    if(!socket) return;

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);

      if(message.type === "joined"){
        router.push(`/game/${roomCode}`
        );
      }
      
      if(message.type === "created"){
        router.push(`/game/${roomCode}`);
      }
      
      if(message.type === "error"){
        setError(message.message);
      }
    })
  }
  const joinSubmit = () => {
    if(!checkUsername()){
      setError("username too short");
      return;
    }
    const socket = joinRoom(joinCode, name)
    listenForResult(socket, joinCode);
  }
  const createSubmit = () => {
    if(!checkUsername()){
      setError("username too short");
      return;
    }
    const {roomCode, socket} = createRoom(name);
    listenForResult(socket, roomCode)
  }

  return (
    <div className="relative isolate flex flex-1 flex-col items-center justify-center overflow-hidden bg-green-500">
      <div
        aria-hidden="true"
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
              className={`absolute top-[-15vh] animate-suit-fall leading-none opacity-0 [text-shadow:0_2px_2px_rgb(0_0_0_/_12%)] will-change-[transform,opacity] motion-reduce:translate-y-[50vh] motion-reduce:animate-none motion-reduce:opacity-100 ${suit === "♥" || suit === "♦" ? "text-red-800" : "text-green-900"}`}
              key={index}
              style={style}
            >
              {suit}
            </span>
          );
        })}
      </div>

      <h1 className="relative z-10 font-henny-penny text-7xl font-bold text-white text-shadow-md">
        Euchre!
      </h1>
      <div className="flex flex-col">
        <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={"Enter username"}
                className="border border-gray-300 bg-white px-4 py-2 pr-9 text-black transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-red-700"
              >
                ♥
              </span>
          </div>
        <button
          className="relative bg-white pr-9 text-black"
          onClick={createSubmit}
        >
          Create Game
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-black"
          >
            ♣
          </span>
        </button>
        <div className="flex">
          <div className="relative">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder={"Enter Join Code"}
              className="border border-gray-300 bg-white px-4 py-2 pr-9 text-black transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-red-700"
            >
              ♥
            </span>
          </div>
          <button
            className="relative bg-white pr-9 text-black"
            onClick={joinSubmit}
          >
            submit join code
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-red-700"
            >
              ♦
            </span>
          </button>
        </div>
        {error && <div>{error}</div>}
      </div>
    </div>
  );
}
