import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import open from "open";
import { loadConfig, saveConfig, type Tokens } from "./config.js";

const redirectUri = "http://127.0.0.1:8888/callback";
const scopes = [
  "playlist-read-private",
  "playlist-read-collaborative",
  "playlist-modify-public",
  "playlist-modify-private",
];

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

async function requestTokens(parameters: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(parameters),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Spotify authentication failed (${response.status}): ${detail}`);
  }

  return await response.json() as TokenResponse;
}

function toTokens(response: TokenResponse, previousRefreshToken?: string): Tokens {
  const refreshToken = response.refresh_token ?? previousRefreshToken;
  if (!refreshToken) {
    throw new Error("Spotify did not return a refresh token. Please authenticate again.");
  }

  return {
    accessToken: response.access_token,
    refreshToken,
    expiresAt: Date.now() + response.expires_in * 1000,
  };
}

async function waitForCallback(expectedState: string): Promise<string> {
  const server = createServer();
  let timeout: NodeJS.Timeout;

  const callback = new Promise<string>((resolve, reject) => {
    server.on("request", (request, response) => {
      const url = new URL(request.url ?? "/", redirectUri);
      if (url.pathname !== "/callback") {
        response.writeHead(404).end("Not found");
        return;
      }

      const error = url.searchParams.get("error");
      const state = url.searchParams.get("state");
      const code = url.searchParams.get("code");

      if (error || state !== expectedState || !code) {
        response.writeHead(400, { "Content-Type": "text/plain" });
        response.end("Authentication failed. You can close this window and return to the terminal.");
        reject(new Error(error ? `Spotify authentication was denied: ${error}` : "Invalid authentication callback."));
        return;
      }

      response.writeHead(200, { "Content-Type": "text/html" });
      response.end("<h1>Authentication complete</h1><p>You can close this window and return to the terminal.</p>");
      resolve(code);
    });

    server.once("error", reject);
    server.listen(8888, "127.0.0.1");
    timeout = setTimeout(() => reject(new Error("Authentication timed out after five minutes.")), 5 * 60 * 1000);
  });

  try {
    return await callback;
  } finally {
    clearTimeout(timeout!);
    server.close();
  }
}

export async function login(clientId: string): Promise<void> {
  const verifier = randomBytes(64).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(24).toString("base64url");
  const authorizationUrl = new URL("https://accounts.spotify.com/authorize");
  authorizationUrl.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    code_challenge_method: "S256",
    code_challenge: challenge,
    state,
    scope: scopes.join(" "),
  }).toString();

  console.log("Opening Spotify in your browser. If it does not open, visit:\n" + authorizationUrl.href);
  const callback = waitForCallback(state);
  try {
    await open(authorizationUrl.href);
  } catch {
    console.log("Could not open the browser automatically; use the URL above.");
  }

  const code = await callback;
  const response = await requestTokens({
    client_id: clientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });
  const config = await loadConfig();
  await saveConfig({ ...config, clientId, tokens: toTokens(response, config.tokens?.refreshToken) });
  console.log("Spotify authentication complete.");
}

export async function logout(): Promise<void> {
  const config = await loadConfig();
  delete config.tokens;
  await saveConfig(config);
  console.log("Spotify credentials removed from this device.");
}

export async function getConfiguredClientId(): Promise<string | undefined> {
  return process.env.SPOTIFY_CLIENT_ID ?? (await loadConfig()).clientId;
}

export async function getAccessToken(): Promise<string> {
  const config = await loadConfig();
  const clientId = process.env.SPOTIFY_CLIENT_ID ?? config.clientId;

  if (!clientId) {
    throw new Error("No Spotify client ID configured. Run `spotify-cli-utils auth` first.");
  }
  if (!config.tokens) {
    throw new Error("Not authenticated. Run `spotify-cli-utils auth` first.");
  }

  if (config.tokens.expiresAt > Date.now() + 60_000) {
    return config.tokens.accessToken;
  }

  const response = await requestTokens({
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: config.tokens.refreshToken,
  });
  const tokens = toTokens(response, config.tokens.refreshToken);
  await saveConfig({ ...config, clientId, tokens });
  return tokens.accessToken;
}
