import { createHash, timingSafeEqual } from "node:crypto";
import {
  Account,
  AppwriteException,
  Client,
  Databases,
  Permission,
  Query,
  Role,
  type Models,
} from "node-appwrite";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type ResultDocument = Models.Document & {
  userId: string;
  won: boolean;
};

type MatchResult = {
  matchId: string;
  roomCode: string;
  blueScore: number;
  redScore: number;
  players: Array<{ userId: string; team: "blue" | "red" }>;
};

function config() {
  const endpoint = process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;
  const databaseId = process.env.APPWRITE_DATABASE_ID;
  const collectionId = process.env.APPWRITE_RESULTS_COLLECTION_ID;

  if (!endpoint || !projectId || !apiKey || !databaseId || !collectionId) {
    throw new Error("Appwrite server environment is incomplete");
  }

  return { endpoint, projectId, apiKey, databaseId, collectionId };
}

function adminDatabases() {
  const values = config();
  const client = new Client()
    .setEndpoint(values.endpoint)
    .setProject(values.projectId)
    .setKey(values.apiKey);
  return { databases: new Databases(client), ...values };
}

function bearer(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function secretMatches(received: string, expected: string) {
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: NextRequest) {
  try {
    const jwt = bearer(request);
    if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const values = config();
    const sessionClient = new Client()
      .setEndpoint(values.endpoint)
      .setProject(values.projectId)
      .setJWT(jwt);
    const user = await new Account(sessionClient).get();
    const { databases, databaseId, collectionId } = adminDatabases();
    const results = await databases.listDocuments<ResultDocument>({
      databaseId,
      collectionId,
      queries: [Query.equal("userId", [user.$id]), Query.limit(5000)],
    });
    const wins = results.documents.filter((result) => result.won).length;

    return NextResponse.json({
      games: results.documents.length,
      wins,
      losses: results.documents.length - wins,
    });
  } catch (error) {
    console.error("Could not read stats", error);
    return NextResponse.json({ error: "Could not read stats" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.PARTYKIT_STATS_SECRET;
  if (!expectedSecret || !secretMatches(bearer(request), expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await request.json() as MatchResult;
    if (
      !result.matchId ||
      !result.roomCode ||
      !Number.isFinite(result.blueScore) ||
      !Number.isFinite(result.redScore) ||
      !Array.isArray(result.players) ||
      result.players.some((player) => !player.userId || !["blue", "red"].includes(player.team))
    ) {
      return NextResponse.json({ error: "Invalid match result" }, { status: 400 });
    }

    const { databases, databaseId, collectionId } = adminDatabases();
    const winningTeam = result.blueScore > result.redScore ? "blue" : "red";

    await Promise.all(result.players.map(async (player) => {
      const documentId = createHash("sha256")
        .update(`${result.matchId}:${player.userId}`)
        .digest("hex")
        .slice(0, 36);

      try {
        await databases.createDocument({
          databaseId,
          collectionId,
          documentId,
          data: {
            userId: player.userId,
            matchId: result.matchId,
            roomCode: result.roomCode,
            team: player.team,
            won: player.team === winningTeam,
            teamScore: player.team === "blue" ? result.blueScore : result.redScore,
            opponentScore: player.team === "blue" ? result.redScore : result.blueScore,
            playedAt: new Date().toISOString(),
          },
          permissions: [Permission.read(Role.user(player.userId))],
        });
      } catch (error) {
        if (!(error instanceof AppwriteException) || error.code !== 409) throw error;
      }
    }));

    return NextResponse.json({ recorded: true });
  } catch (error) {
    console.error("Could not record stats", error);
    return NextResponse.json({ error: "Could not record stats" }, { status: 500 });
  }
}
