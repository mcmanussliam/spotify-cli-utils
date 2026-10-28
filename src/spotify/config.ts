import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface Config {
  clientId?: string;
  tokens?: Tokens;
}

const configDirectory = process.env.SPOTIFY_CLI_UTILS_CONFIG_DIR
  ?? join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "spotify-cli-utils");
const configPath = join(configDirectory, "config.json");

export async function loadConfig(): Promise<Config> {
  try {
    return JSON.parse(await readFile(configPath, "utf8")) as Config;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

export async function saveConfig(config: Config): Promise<void> {
  await mkdir(configDirectory, { recursive: true, mode: 0o700 });
  const temporaryPath = `${configPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(config, null, 2), { mode: 0o600 });
  await rename(temporaryPath, configPath);
  await chmod(configPath, 0o600);
}

export async function saveBackup(
  playlistId: string,
  playlistName: string,
  uris: readonly (string | null)[],
): Promise<string> {
  const backupsDirectory = join(configDirectory, "backups");
  await mkdir(backupsDirectory, { recursive: true, mode: 0o700 });
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const path = join(backupsDirectory, `${playlistId}-${timestamp}.json`);
  await writeFile(path, JSON.stringify({
    playlistId,
    playlistName,
    createdAt: new Date().toISOString(),
    uris,
  }, null, 2), { mode: 0o600 });
  return path;
}

export function getConfigPath(): string {
  return configPath;
}
