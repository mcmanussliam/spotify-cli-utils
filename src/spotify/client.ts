const apiBaseUrl = "https://api.spotify.com/v1";

interface Page<T> {
  items: T[];
  next: string | null;
}

export interface User {
  id: string;
  display_name: string | null;
}

export interface Playlist {
  id: string;
  name: string;
  collaborative: boolean;
  public: boolean | null;
  snapshot_id: string;
  owner: { id: string; display_name: string | null };
  items?: { total: number };
  /** @deprecated Spotify renamed this field to `items` in February 2026. */
  tracks?: { total: number };
}

export function getPlaylistItemCount(playlist: Playlist): number | undefined {
  return playlist.items?.total ?? playlist.tracks?.total;
}

interface PlaylistEntry {
  item?: { uri: string; name: string } | null;
  track?: { uri: string; name: string } | null;
}

export interface PlaylistTrack {
  uri: string | null;
  name: string;
}

export class SpotifyClient {
  constructor(private readonly getAccessToken: () => Promise<string>) {}

  private async request<T>(path: string, init: RequestInit = {}, retries = 3): Promise<T> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${await this.getAccessToken()}`,
        ...init.headers,
      },
    });

    if (response.status === 429 && retries > 0) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? "1");
      await new Promise((resolve) => setTimeout(resolve, Math.max(1, retryAfter) * 1000));
      return this.request<T>(path, init, retries - 1);
    }

    if (!response.ok) {
      let message = response.statusText;
      try {
        const body = await response.json() as { error?: { message?: string } | string };
        message = typeof body.error === "string" ? body.error : body.error?.message ?? message;
      } catch {
        // Spotify did not return a JSON error body.
      }
      throw new Error(`Spotify API error (${response.status}): ${message}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return await response.json() as T;
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>("/me");
  }

  async getPlaylists(): Promise<Playlist[]> {
    const playlists: Playlist[] = [];
    let offset = 0;
    let next: string | null;

    do {
      const page: Page<Playlist> = await this.request<Page<Playlist>>(`/me/playlists?limit=50&offset=${offset}`);
      playlists.push(...page.items);
      next = page.next;
      offset += page.items.length;
    } while (next);

    return playlists;
  }

  async getPlaylist(playlistId: string): Promise<Playlist> {
    return this.request<Playlist>(`/playlists/${encodeURIComponent(playlistId)}`);
  }

  async getPlaylistTracks(playlistId: string): Promise<PlaylistTrack[]> {
    const tracks: PlaylistTrack[] = [];
    let offset = 0;
    let next: string | null;

    do {
      const query = new URLSearchParams({ limit: "50", offset: String(offset) });
      const page = await this.request<Page<PlaylistEntry>>(
        `/playlists/${encodeURIComponent(playlistId)}/items?${query}`,
      );

      for (const entry of page.items) {
        const track = entry.item ?? entry.track;
        tracks.push(track?.uri
          ? track
          : { uri: null, name: "Unavailable entry" });
      }

      next = page.next;
      offset += page.items.length;
    } while (next);

    return tracks;
  }

  async reorderPlaylistItem(
    playlistId: string,
    rangeStart: number,
    insertBefore: number,
    snapshotId: string,
  ): Promise<string> {
    const response = await this.request<{ snapshot_id: string }>(`/playlists/${encodeURIComponent(playlistId)}/items`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        range_start: rangeStart,
        range_length: 1,
        insert_before: insertBefore,
        snapshot_id: snapshotId,
      }),
    });
    return response.snapshot_id;
  }
}
