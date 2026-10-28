import assert from "node:assert/strict";
import test from "node:test";
import { getPlaylistItemCount, type Playlist } from "./client.js";

const playlist = {
  id: "playlist-id",
  name: "Test playlist",
  collaborative: false,
  public: true,
  snapshot_id: "snapshot",
  owner: { id: "user-id", display_name: "User" },
};

test("getPlaylistItemCount supports Spotify's current items field", () => {
  assert.equal(getPlaylistItemCount({ ...playlist, items: { total: 42 } }), 42);
});

test("getPlaylistItemCount supports the deprecated tracks field", () => {
  assert.equal(getPlaylistItemCount({ ...playlist, tracks: { total: 12 } }), 12);
});

test("getPlaylistItemCount handles metadata without an item count", () => {
  assert.equal(getPlaylistItemCount(playlist), undefined);
});
