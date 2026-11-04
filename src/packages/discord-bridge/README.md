# Orca Discord bridge

A local bot that lets an allowlisted Discord user drive Claude Code / Codex terminal sessions
running in Orca. It runs on the same machine and OS account as Orca. It talks to Orca the way the
`orca` CLI does (the `orca-runtime.json` token over the local socket or named pipe) and to Discord
over an outbound gateway connection, so nothing is exposed to the internet.

Orca stays the source of truth. A Discord thread id is the connector conversation id
(`source: 'discord'`), and Orca persists the thread → pane link on the workspace. The bridge itself
only remembers which replies and prompt cards it has already posted (`thread-posts.json`).

## 1. Discord application (one time)

1. In the [developer portal](https://discord.com/developers/applications), create an application and add a **Bot**.
2. Under **Bot**, turn on **Message Content Intent**.
3. Under **OAuth2 → URL Generator**, pick scopes `bot` and `applications.commands`, plus these bot permissions:
   View Channels, Send Messages, Send Messages in Threads, Create Public Threads, Read Message History,
   Add Reactions. Open the URL and add the bot to your server.
4. Turn on Developer Mode in Discord (User Settings → Advanced). Right-click the server to copy its id,
   then right-click your name to copy your user id.

## 2. Config

Create `~/.orca/discord-bridge/bridge.env` (Windows: `%USERPROFILE%\.orca\discord-bridge\bridge.env`)
and make it readable only by you (`chmod 600` on macOS/Linux):

```env
DISCORD_BOT_TOKEN=...
DISCORD_GUILD_ID=...
# Comma-separated; only these users can message sessions, answer prompts or run /orca.
DISCORD_ALLOWED_USER_IDS=...
# Optional: Orca's profile dir, when Orca isn't using the default one.
# ORCA_USER_DATA_PATH=...
```

Real environment variables override the file. Never commit this file.

## 3. Run

Orca must be a build that includes `connector.link`. Start it first, then:

```sh
# Once per Orca profile: turn on connectors (there's no settings toggle yet).
pnpm -C src/packages/discord-bridge start --enable-connectors

pnpm -C src/packages/discord-bridge start
```

Logs are one JSON line per event. Tokens and message text are never logged.

## 4. Use

- `/orca sessions` lists running Claude Code / Codex panes.
- `/orca link session:<pick>` run in a text channel creates a thread for that session. Run inside a
  thread, it links that thread.
- Messages in a linked thread go to the session (📨 means Orca took it). The agent's reply is posted
  when its turn ends, including turns typed on the desktop.
- Approval and single-choice question prompts appear as buttons. Anything else says to answer in Orca.
- `/orca unlink` detaches the thread. The agent keeps running.

## Known limits (Phase 1)

- Terminal agents only (Claude Code, Codex). Native-chat sessions aren't covered.
- Events arrive in 3-second watch windows, not a push stream.
- No project channels, workspace threads, notification levels or inbox yet (see
  `docs/discord-integration/ARCHITECTURE_FINDINGS.md`).
- Turning on connectors also turns on Orca Cloud's connector client. It only acts on Slack or Discord
  conversations you've linked through Orca Cloud.
