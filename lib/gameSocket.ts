import PartySocket from "partysocket";

const PARTYKIT_HOST = "localhost:1999";

function generateRoomCode(){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
}
export function connectToGame(roomCode: string, playerName: string, mode="join"){
  try { 
    const socket = new PartySocket({
    host: PARTYKIT_HOST,
    room: roomCode.toUpperCase(),
    query: {
      name: playerName,
      mode: mode
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