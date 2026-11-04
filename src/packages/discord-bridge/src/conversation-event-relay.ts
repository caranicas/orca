import type { PendingPrompt } from '../../../shared/agent-pending-prompt'
import type {
  ConversationEvent,
  ConversationSnapshot,
  OrcaConnectorClient
} from './orca-connector-client'
import type { ThreadPostLedger } from './thread-post-ledger'
import { turnEndedText } from './discord-post-text'

export type ThreadPoster = {
  postPrompt(threadId: string, prompt: PendingPrompt): Promise<void>
  postText(threadId: string, text: string): Promise<void>
  showTyping(threadId: string): Promise<void>
}

// Short windows keep reply latency low; the host returns each window's events at its end.
const WATCH_WINDOW_MS = 3_000
const MAX_BACKOFF_MS = 30_000

/** Relays connector events for Discord conversations into their threads. */
export class ConversationEventRelay {
  private stopped = false

  constructor(
    private readonly orca: Pick<OrcaConnectorClient, 'watch'>,
    private readonly poster: ThreadPoster,
    private readonly ledger: ThreadPostLedger,
    private readonly log: (event: string, fields?: Record<string, unknown>) => void
  ) {}

  async run(): Promise<void> {
    let backoffMs = 1_000
    let connected: boolean | null = null
    while (!this.stopped) {
      try {
        const { snapshot, events } = await this.orca.watch(WATCH_WINDOW_MS)
        if (connected !== true) {
          this.log('orca_connected')
          connected = true
        }
        backoffMs = 1_000
        if (snapshot) {
          await this.recover(snapshot)
        }
        for (const event of events) {
          await this.relay(event)
        }
      } catch (error) {
        if (connected !== false) {
          this.log('orca_unreachable', { error: describe(error) })
          connected = false
        }
        await delay(backoffMs)
        backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS)
      }
    }
  }

  stop(): void {
    this.stopped = true
  }

  /** A snapshot carries what a gap between windows, or a bridge restart, could have missed. */
  private async recover(snapshot: ConversationSnapshot): Promise<void> {
    for (const entry of snapshot.conversations) {
      if (entry.conversation.source !== 'discord') {
        continue
      }
      const threadId = entry.conversation.externalId
      if (entry.prompt) {
        await this.prompt(threadId, entry.prompt)
      }
      // An unstamped turn can't be told apart from one already posted, so only live events post it.
      const { turnId, lastAssistantMessage: message } = entry
      if (
        !entry.working &&
        turnId !== null &&
        message &&
        this.ledger.shouldPostTurn(threadId, turnId) &&
        (await this.post(threadId, () => this.poster.postText(threadId, message)))
      ) {
        this.ledger.record(threadId, { postedTurnId: turnId })
      }
    }
  }

  private async relay(event: ConversationEvent): Promise<void> {
    if (event.conversation.source !== 'discord') {
      return
    }
    const threadId = event.conversation.externalId
    if (event.kind === 'prompt') {
      await this.prompt(threadId, event.prompt)
    } else if (event.kind === 'turn-started') {
      await this.post(threadId, () => this.poster.showTyping(threadId))
    } else if (event.kind === 'turn-ended') {
      await this.turnEnded(threadId, event)
    }
  }

  private async turnEnded(
    threadId: string,
    event: Extract<ConversationEvent, { kind: 'turn-ended' }>
  ): Promise<void> {
    if (!this.ledger.shouldPostTurn(threadId, event.turnId)) {
      return
    }
    const text = turnEndedText(event.stopReason, event.lastAssistantMessage)
    const posted = await this.post(threadId, () => this.poster.postText(threadId, text))
    if (posted && event.turnId !== null) {
      this.ledger.record(threadId, { postedTurnId: event.turnId })
    }
  }

  private async prompt(threadId: string, prompt: PendingPrompt): Promise<void> {
    if (this.ledger.get(threadId).postedPromptId === prompt.promptId) {
      return
    }
    if (await this.post(threadId, () => this.poster.postPrompt(threadId, prompt))) {
      this.ledger.record(threadId, { postedPromptId: prompt.promptId })
    }
  }

  /** A failed post must not stall other threads; the next snapshot retries what it can. */
  private async post(threadId: string, send: () => Promise<void>): Promise<boolean> {
    try {
      await send()
      return true
    } catch (error) {
      this.log('discord_post_failed', { threadId, error: describe(error) })
      return false
    }
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
