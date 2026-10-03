import { Account, Client } from "appwrite";

export const appwriteEndpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "";
export const appwriteProjectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";
export const isAppwriteConfigured = Boolean(appwriteEndpoint && appwriteProjectId);

const client = new Client();

if (isAppwriteConfigured) {
  client.setEndpoint(appwriteEndpoint).setProject(appwriteProjectId);
}

export const account = new Account(client);

export async function createAppwriteJWT() {
  if (!isAppwriteConfigured) {
    throw new Error("Appwrite is not configured");
  }

  const result = await account.createJWT();
  return result.jwt;
}
