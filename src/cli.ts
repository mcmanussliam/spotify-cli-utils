#!/usr/bin/env node
import { input } from "@inquirer/prompts";
import { Command } from "commander";
import { listPlaylists } from "./commands/playlists.js";
import { shufflePlaylist } from "./commands/shuffle.js";
import { getAccessToken, getConfiguredClientId, login, logout } from "./spotify/auth.js";
import { SpotifyClient } from "./spotify/client.js";

const program = new Command();

program
  .name("spotify-cli-utils")
  .description("Useful Spotify utilities for your terminal")
  .version("0.1.0");

program
  .command("auth")
  .description("Authenticate with Spotify using OAuth PKCE")
  .action(async () => {
    const configuredClientId = await getConfiguredClientId();
    const clientId = await input({
      message: "Spotify application client ID:",
      default: configuredClientId,
      validate: (value) => value.trim().length > 0 || "A client ID is required.",
    });
    await login(clientId.trim());
  });

program
  .command("logout")
  .description("Remove saved Spotify credentials")
  .action(logout);

program
  .command("playlists")
  .description("List the playlists in your Spotify library")
  .action(async () => {
    await listPlaylists(new SpotifyClient(getAccessToken));
  });

program
  .command("shuffle")
  .description("Randomise a playlist's order without changing its entries")
  .option("-p, --playlist <id>", "Spotify playlist ID (skip the interactive selection)")
  .action(async (options: { playlist?: string }) => {
    await shufflePlaylist(options.playlist);
  });

program.showHelpAfterError();

try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (error instanceof Error && error.name === "ExitPromptError") {
    console.log("\nCancelled.");
    process.exitCode = 130;
  } else {
    console.error(`\nError: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
