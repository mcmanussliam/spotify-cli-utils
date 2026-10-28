import { getPlaylistItemCount, type SpotifyClient } from "../spotify/client.js";

export async function listPlaylists(client: SpotifyClient): Promise<void> {
  const [user, playlists] = await Promise.all([client.getCurrentUser(), client.getPlaylists()]);

  if (playlists.length === 0) {
    console.log("No playlists found in your Spotify library.");
    return;
  }

  console.log(`Spotify playlists for ${user.display_name ?? user.id}:\n`);
  for (const playlist of playlists) {
    const access = playlist.owner.id === user.id || playlist.collaborative ? "editable" : "followed";
    console.log(`${playlist.name} — ${getPlaylistItemCount(playlist) ?? "unknown"} entries (${access})`);
    console.log(`  ID: ${playlist.id}`);
  }
  console.log(`\n${playlists.length} playlist${playlists.length === 1 ? "" : "s"}.`);
}
