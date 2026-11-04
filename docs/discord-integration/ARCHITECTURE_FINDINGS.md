# Discord Integration — Architecture Findings (Phase 0)

Base: `main` @ `da22c3bee2a` (fork main, upstream `e65171ae019` + custom commits).
Legend: **[V]** verified by reading the code · **[I]** inferred, not yet confirmed.

## TL;DR

- Orca already has a **provider-neutral connector seam** with `discord` as a source. It provides linked
  external conversations, idempotent sends, structured approval/question prompts that are answered
  under a fence, and turn events. A local Discord bridge should sit on it rather than build a parallel path. [V]
- A **local bridge process** can authenticate exactly like the `orca` CLI (`orca-runtime.json` token
  over the local socket/pipe). No public endpoint is needed: the Discord Gateway is an outbound websocket
  and button/slash interactions arrive over it. [V]
- **One core gap:** the seam only links a conversation it _launches_ (`connector.start`). The spec's core
  requirement is mirroring _existing_ desktop sessions into threads. That needs a small new
  `connector.link` RPC. [V]
- Orca's own hosted Discord bot (`cloud/apps/connector`) exists but is a multi-tenant cloud service
  (Postgres, Orca account tokens, public interactions URL). It starts conversations from a Discord @mention,
  not from desktop sessions. Not a fit for a self-run integration. [V]

## 1. Relevant modules

| Area                        | Path                                                                                                               | Notes                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Runtime RPC server          | `src/main/runtime/runtime-rpc/runtime-rpc-lifecycle.ts`, `src/main/runtime/rpc/unix-socket-transport.ts`           | Local socket (`<userData>/o-<pid>-*.sock`) or `\\.\pipe\orca-*` on Windows; newline JSON, 1 MB/message, 30 s idle [V]     |
| Discovery/auth              | `src/shared/runtime-bootstrap.ts`, `src/cli/runtime/metadata.ts`                                                   | `<userData>/orca-runtime.json` = `{runtimeId,pid,transports[],authToken}`; token rotates per launch [V]                   |
| Node RPC client             | `src/cli/runtime/client.ts` (`RuntimeClient.call`), `src/cli/runtime/transport.ts`                                 | One request per connection; retries/timeouts [V]                                                                          |
| Method registry             | `src/main/runtime/rpc/methods/index.ts`, `rpc/dispatcher.ts`                                                       | Streaming methods are WebSocket-only; the socket supports unary calls only [V]                                            |
| Connector RPC               | `src/main/runtime/rpc/methods/connector.ts`, params `src/shared/rpc-contract/connector-params.ts`                  | `connector.start/send/pendingPrompt/answer/cancel/reply/watch` [V]                                                        |
| Connector seam              | `src/main/external-conversations/*`                                                                                | Links, delivery receipts, prompts, events, reopen [V]                                                                     |
| Link model                  | `src/shared/external-conversation-link.ts`                                                                         | `{source, externalId, paneKey, agent: claude\|codex, providerSession?, createdAt}`, persisted on the workspace record [V] |
| Pending prompts             | `src/shared/agent-pending-prompt.ts`, `src/main/runtime/terminal-agent-prompt-answer.ts`                           | `approval` / `question` / `unsupported`; answers are re-fenced keystrokes [V]                                             |
| Hook status                 | `src/shared/agent-status-types.ts`, `src/main/agent-hooks/agent-transition-detector.ts`                            | `working\|blocked\|waiting\|done`, `lastAssistantMessage`, `toolName`, `interactivePrompt` [V]                            |
| Structured sessions         | `src/main/native-chat/*`, `rpc/methods/structured-agent-session*.ts`                                               | Separate model: `agentSession.*`, SQLite journal [V]                                                                      |
| Catalog                     | `repo.list`, `projectGroup.list`, `worktree.list`, `folderWorkspace.list`, `terminal.list`, `session.tabs.listAll` | [V] (names); shapes to be confirmed in Phase 2                                                                            |
| Secret store                | `src/shared/secret-store.ts`, `src/main/credentials/encrypted-api-key-file-store.ts`                               | Electron-free `SecretStore` pattern for Node hosts [V]                                                                    |
| Hosted bot (reference only) | `cloud/apps/connector/src/discord-*.ts`, `connector-copy.ts`                                                       | Rendering, prompt cards and escaping are worth borrowing as patterns [V]                                                  |

## 2. Identity model

- **Project.** `Repo.id` (`src/shared/repo-types.ts`); `Project.id` groups repos (`src/shared/project-types.ts`). [V]
- **Workspace.** Worktree id = `${repoId}::${path}` (`src/shared/worktree/id.ts`). A folder workspace has its own
  `FolderWorkspace.id`. A `WorkspaceKey` is `worktree:<id>` or `folder:<id>`. [V]
- **Agent sessions come in two independent models.** [V]
  - **Terminal (TUI) agents.** Claude Code / Codex run in a PTY. Identity = `paneKey` (`${tabId}:${leafId}`), and the provider's
    own session id is in `providerSession`. **This is what the connector seam supports.**
  - **Structured / native-chat sessions.** `sessionId` on `AgentSessionRecord`, persisted in
    `agent-session-journal.db`. Driven by `agentSession.*`; the connector seam does **not** cover these.
- **Discord routing key.** Use `externalId = <discord thread id>` with `source = 'discord'`, never thread names.

## 3. Messaging

- **Discord → Orca.** `connector.send({source, externalId, deliveryId, text})`. The seam types into the linked
  pane only if the same agent process is still there (binding fence). A repeated `deliveryId` returns the
  recorded result instead of sending again. Use the Discord message id as `deliveryId` to get dedup for free. [V]
- **Orca → Discord.** Seam events: `linked`, `prompt {PendingPrompt}`, `turn-started`,
  `turn-ended {stopReason, lastAssistantMessage}`. Desktop-typed turns emit these too, so desktop-originated
  replies are covered. [V]
- **Event transport limitation.** Over the local socket the only reader is `connector.watch({forMs ≤ 10 min})`,
  which returns `{snapshot, events}` at the end of a window. It is commented as "dev only" but is not gated beyond
  `experimentalConnectors`. Back-to-back windows work, but the latency equals the window length and events in
  the gap between windows are missed. The snapshot carries `turnId` / `working` / `prompt` but not the last message. [V]

## 4. Approvals

- Terminal agents: `PendingPrompt` with a stable `promptId`.
  - `connector.answer({promptId, optionId})` re-checks that the same prompt is still showing in the same process
    before typing the agent's own accept/deny keys.
  - Orca's own permission flow is never bypassed: Discord just presses the same keys the user would.
  - Only two-option approvals and single-select questions are answerable. Anything else is `unsupported`
    ("answer in Orca"). [V]
- Refusals are typed (`prompt_not_pending`, `option_not_offered`, …). They map onto "already answered / expired"
  messages. [V]

## 5. Notifications / verbosity

- Turn ends carry `stopReason` (`AgentTurnOutcome`: success, failure, cancellation…), which feeds completion vs
  failure notices. [V]
- Waiting/blocked prompts → the `prompt` event. Unsupported prompts still signal "needs you". [V]
- Verbose: hook rows expose `toolName` plus a bounded `toolInput` preview, with no reasoning. Readable via
  `terminal.agentStatus`. There is no per-tool event stream for terminal agents. [V]
- Reasoning is never present in `lastAssistantMessage`. [I — confirm against Claude/Codex hook payloads]

## 6. Auth & security

- Local socket: the possession of the userData token grants owner scope. The bridge must run as the same OS user
  on the same machine as Orca. [V]
- Remote/paired use: a `runtime`-scope pairing over WebSocket (`src/shared/remote-runtime/remote-runtime-client.ts`)
  also gives streaming subscriptions. A later option. [V]
- Bot token: env var / `SecretStore`-sealed file in the bridge's own data dir. Never in the renderer. [I]
- Discord authorization: guild allowlist and user allowlist checked on every message and interaction. [design]

## 7. Recommended architecture

```text
Discord Gateway (outbound WS) ─▶ orca-discord bridge (local Node process, same machine/user as Orca)
                                   ├── authz (guild + user allowlist)
                                   ├── router: thread id ─▶ {source:'discord', externalId}
                                   ├── mapping store (JSON in its own data dir)
                                   └── RuntimeClient over orca-runtime.json socket
                                         ├── connector.send / answer / cancel / pendingPrompt
                                         ├── connector.link   (NEW — attach existing pane)
                                         ├── connector.watch  (events; stream later)
                                         └── repo/worktree/folderWorkspace/terminal.list (catalog)
```

- **Placement.** A new `src/packages/discord-bridge` (own package.json/tsconfig/vitest like `process-host`), reusing
  `src/cli/runtime/*` for transport. [I — confirm the bundling of shared sources]
- **Library.** `@discordjs/ws` + `@discordjs/rest`, which `cloud/apps/connector` already uses, or `discord.js`.
- **Cross-platform.** The socket/pipe transport already handles Windows. The bridge has no shell-specific code.

## 8. Required Orca changes (smallest safe set)

1. **`connector.link`** `{source, externalId, paneKey}`: attach an existing Claude/Codex pane to a
   conversation via `writeLink`, refusing panes that are not admitted connector agents or are already linked
   elsewhere. Plus **`connector.unlink`**. This is the spec's core gap.
2. **Later:** a streaming `connector.subscribe` (WebSocket) to replace watch windows, or carry
   `lastAssistantMessage` on snapshot entries so a gap between windows can't drop a reply.
3. **Later:** a structured-session path (`agentSession.send` / `subscribeTurnCompletions` / `respondToApproval`)
   if native-chat sessions must be mirrored too.

### Status (Phase 1)

- Done:
  - `connector.link` / `connector.unlink` (seam + RPC + tests).
  - Snapshot entries carry the idle pane's `lastAssistantMessage`, so a missed `turn-ended` is recovered.
- Done: `src/packages/discord-bridge`. Its own tests pass.
- Smoke-tested against a real dev Orca build (link refusal, enable, unlink, watch).
- **Pending:** an end-to-end check with a real Discord message to a real Claude/Codex session (needs the bot token).

## 9. Missing capabilities vs spec

| Spec item                            | Status                                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Message existing session             | Needs `connector.link`                                                                             |
| Desktop-originated replies           | Covered by turn events                                                                             |
| Approvals                            | Two-option approvals / single-select questions only; others link back to Orca                      |
| Native-chat sessions                 | Not covered by the seam; separate phase                                                            |
| Real-time events                     | Watch windows (latency); stream is a follow-up                                                     |
| Workspace threads / project channels | Bridge-side only (catalog RPCs)                                                                    |
| Start/stop/resume                    | `connector.start` / `connector.cancel`; reopen exists in seam; `terminal.close` for stop [V names] |

## 10. Risks / tradeoffs

- Enabling `experimentalConnectors` also enables the Orca Cloud connector client
  (`src/main/connector-cloud/connector-cloud-install.ts`). It should be inert without an Orca account link. [I — verify]
- The connector seam is experimental upstream code. Its contracts may change when merging upstream.
- Running on the Windows PC as well means each machine runs its own bridge and bot session. Discord allows one
  gateway session per bot token per shard, so use two bot applications or run one bridge. [I]
- `connector.watch` latency and gap behavior affect the "feels live" bar until a stream exists.
