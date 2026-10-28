# spotify-cli-utils

A collection of Spotify command-line utilities.

## Requirements

- Node.js 20 or newer
- A Spotify account
- A free application in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)

In your Spotify application settings, add this exact redirect URI:

```text
http://127.0.0.1:8888/callback
```

## Install

```sh
npm install
npm run build
npm link
```

This makes the `spotify-cli-utils` command available in your terminal. For development without linking, replace `spotify-cli-utils` in the examples below with `npm run dev --`.

## Development

```sh
npm run dev -- --help
npm test
npm run typecheck
npm run build
```
