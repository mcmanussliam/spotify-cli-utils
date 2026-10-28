import { confirm, select } from "@inquirer/prompts";
import { createReorderPlan, shuffledOrder, type ReorderOperation } from "../lib/shuffle.js";
import { getAccessToken } from "../spotify/auth.js";
import { saveBackup } from "../spotify/config.js";
import { getPlaylistItemCount, SpotifyClient, type Playlist } from "../spotify/client.js";

async function choosePlaylist(client: SpotifyClient): Promise<Playlist> {
  const [user, playlists] = await Promise.all([client.getCurrentUser(), client.getPlaylists()]);
  const editablePlaylists = playlists.filter(
    (playlist) => playlist.owner.id === user.id || playlist.collaborative,
  );

  if (editablePlaylists.length === 0) {
    throw new Error("You do not have any playlists that can be edited.");
  }

  const playlistId = await select({
    message: "Which playlist would you like to shuffle?",
    pageSize: 15,
    choices: editablePlaylists.map((playlist) => ({
      name: `${playlist.name} (${getPlaylistItemCount(playlist) ?? "unknown"} entries)`,
      value: playlist.id,
    })),
  });

  return editablePlaylists.find((playlist) => playlist.id === playlistId)!;
}

async function restoreOrder(
  client: SpotifyClient,
  playlistId: string,
  operations: readonly ReorderOperation[],
  initialSnapshot: string,
): Promise<void> {
  let snapshot = initialSnapshot;

  for (const operation of [...operations].reverse()) {
    snapshot = await client.reorderPlaylistItem(
      playlistId,
      operation.insertBefore,
      operation.rangeStart + 1,
      snapshot,
    );
  }
}

export async function shufflePlaylist(playlistOption?: string): Promise<void> {
  const client = new SpotifyClient(getAccessToken);
  const selected = playlistOption
    ? await client.getPlaylist(playlistOption)
    : await choosePlaylist(client);

  console.log(`\nReading all entries from “${selected.name}”…`);
  const tracks = await client.getPlaylistTracks(selected.id);
  const originalUris = tracks.map((track) => track.uri);

  if (originalUris.length < 2) {
    console.log("This playlist has fewer than two entries, so there is nothing to shuffle.");
    return;
  }

  const shouldContinue = await confirm({
    message: `Randomise the order of all ${originalUris.length} entries in “${selected.name}”?`,
    default: false,
  });
  if (!shouldContinue) {
    console.log("Cancelled. The playlist was not changed.");
    return;
  }

  // Do not overwrite edits made in Spotify while the playlist was being read
  // or while the confirmation prompt was open.
  const latest = await client.getPlaylist(selected.id);
  if (latest.snapshot_id !== selected.snapshot_id) {
    throw new Error("The playlist changed while it was being read. No changes were made; please try again.");
  }

  const backupPath = await saveBackup(selected.id, selected.name, originalUris);
  const targetOrder = shuffledOrder(Array.from({ length: originalUris.length }, (_, index) => index));
  const operations = createReorderPlan(originalUris.length, targetOrder);
  const appliedOperations: ReorderOperation[] = [];
  let snapshot = selected.snapshot_id;

  console.log(`Shuffling the playlist with ${operations.length} reorder operations…`);
  try {
    for (const operation of operations) {
      snapshot = await client.reorderPlaylistItem(
        selected.id,
        operation.rangeStart,
        operation.insertBefore,
        snapshot,
      );
      appliedOperations.push(operation);

      if (appliedOperations.length % 25 === 0 || appliedOperations.length === operations.length) {
        console.log(`Progress: ${appliedOperations.length}/${operations.length}`);
      }
    }
  } catch (error) {
    if (appliedOperations.length > 0) {
      console.log("The update failed. Restoring the original order…");
      try {
        await restoreOrder(client, selected.id, appliedOperations, snapshot);
      } catch {
        throw new Error(
          `The update failed and the original order could not be restored. Your backup is at: ${backupPath}`,
          { cause: error },
        );
      }
      throw new Error("The update failed, so the original playlist order was restored.", { cause: error });
    }
    throw new Error(`The update failed before any reorder was confirmed. Your backup is at: ${backupPath}`, {
      cause: error,
    });
  }

  const finalUris = (await client.getPlaylistTracks(selected.id)).map((track) => track.uri);
  const expectedUris = targetOrder.map((index) => originalUris[index]);
  if (finalUris.length !== expectedUris.length || finalUris.some((uri, index) => uri !== expectedUris[index])) {
    throw new Error(`Spotify returned an unexpected playlist order after the update. Your backup is at: ${backupPath}`);
  }

  console.log(`Done! Shuffled all ${originalUris.length} entries without adding or removing any.`);
  console.log(`Original order backed up to: ${backupPath}`);
}
