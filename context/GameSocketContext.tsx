"use client";

import PartySocket from "partysocket";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  createRoom as openCreatedRoom,
  joinRoom as openJoinedRoom,
  parseGameSocketMessage,
  type GameSocketMessage,
} from "@/lib/gameSocket";

type ConnectionStatus = "disconnected" | "connecting" | "connected";

type GameSocketContextValue = {
  roomCode: string | null;
  status: ConnectionStatus;
  lastMessage: GameSocketMessage | null;
  createGame: (playerName: string) => Promise<string>;
  joinGame: (roomCode: string, playerName: string) => Promise<string>;
  send: (message: GameSocketMessage) => void;
  disconnect: () => void;
};

const GameSocketContext = createContext<GameSocketContextValue | null>(null);

export function GameSocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<PartySocket | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [lastMessage, setLastMessage] = useState<GameSocketMessage | null>(null);

  const disconnect = useCallback(() => {
    const socket = socketRef.current;

    socketRef.current = null;
    socket?.close();

    setRoomCode(null);
    setStatus("disconnected");
    setLastMessage(null);
  }, []);

  const attachSocket = useCallback(
    (
      socket: PartySocket,
      code: string,
      expectedResponse: "created" | "joined",
    ) => {
      disconnect();

      socketRef.current = socket;
      setRoomCode(code);
      setStatus("connecting");

      return new Promise<string>((resolve, reject) => {
        let settled = false;

        socket.addEventListener("open", () => {
          if (socketRef.current === socket) {
            setStatus("connected");
          }
        });

        socket.addEventListener("message", (event) => {
          const message = parseGameSocketMessage(event.data);
          setLastMessage(message);

          if (message.type === expectedResponse && !settled) {
            settled = true;
            resolve(code);
          }

          if (message.type === "error" && !settled) {
            settled = true;
            reject(new Error(message.message ?? "Server error"));
          }
        });

        socket.addEventListener("close", () => {
          if (socketRef.current === socket) {
            setStatus("disconnected");
          }

          if (!settled) {
            settled = true;
            reject(new Error("Connection closed"));
          }
        });

        socket.addEventListener("error", () => {
          if (!settled) {
            settled = true;
            reject(new Error("Could not connect to room"));
          }
        });
      });
    },
    [disconnect],
  );

  const createGame = useCallback(
    (playerName: string) => {
      const { roomCode: code, socket } = openCreatedRoom(playerName);

      if (!socket) {
        return Promise.reject(new Error("Could not create socket"));
      }

      return attachSocket(socket, code, "created");
    },
    [attachSocket],
  );

  const joinGame = useCallback(
    (code: string, playerName: string) => {
      const normalizedCode = code.trim().toUpperCase();
      const socket = openJoinedRoom(normalizedCode, playerName);

      if (!socket) {
        return Promise.reject(new Error("Could not create socket"));
      }

      return attachSocket(socket, normalizedCode, "joined");
    },
    [attachSocket],
  );

  const send = useCallback(
    (message: GameSocketMessage) => {
      const socket = socketRef.current;

      if (!socket || socket.readyState !== WebSocket.OPEN) {
        throw new Error("Socket is not connected");
      }

      socket.send(JSON.stringify(message));
    },
    [],
  );

  useEffect(() => {
    return () => {
      socketRef.current?.close();
    };
  }, []);

  return (
    <GameSocketContext.Provider
      value={{
        roomCode,
        status,
        lastMessage,
        createGame,
        joinGame,
        send,
        disconnect,
      }}
    >
      {children}
    </GameSocketContext.Provider>
  );
}

export function useGameSocket() {
  const context = useContext(GameSocketContext);

  if (!context) {
    throw new Error("useGameSocket must be used inside GameSocketProvider");
  }

  return context;
}
