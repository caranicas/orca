import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { PendingPrompt } from '../../../shared/agent-pending-prompt'
import { ConversationEventRelay, type ThreadPoster } from './conversation-event-relay'
import type { ConversationEvent, ConversationSnapshot } from './orca-connector-client'
import { ThreadPostLedger } from './thread-post-ledger'

type Window = {
  snapshot: ConversationSnapshot | null
  events: ConversationEvent[]
}

const THREAD = '123456789012345678'
const ref = {
  conversation: { source: 'discord', externalId: THREAD },
  paneKey: 'tab:leaf'
}
const APPROVAL: PendingPrompt = {
  kind: 'approval',
  promptId: 'p_1',
  tool: 'Bash',
  options: [{ id: 'allow_once', label: 'Allow' }]
}

function idle(turnId: number, message: string): ConversationSnapshot {
  return {
    kind: 'snapshot',
    conversations: [
      {
        ...ref,
        working: false,
        prompt: null,
        turnId,
        lastAssistantMessage: message
      }
    ]
  }
}

/** Runs the relay over scripted watch windows, then stops it. */
async function relayWindows(windows: Window[], ledger: ThreadPostLedger, failPosts = 0) {
  const posts: string[] = []
  let failures = failPosts
  const poster: ThreadPoster = {
    postText: async (_thread, text) => {
      if (failures-- > 0) {
        throw new Error('discord_down')
      }
      posts.push(text)
    },
    postPrompt: async (_thread, prompt) => {
      posts.push(`prompt:${prompt.promptId}`)
    },
    showTyping: async () => {}
  }
  let relay: ConversationEventRelay | null = null
  const queue = [...windows]
  const orca = {
    watch: async (): Promise<Window> => {
      const next = queue.shift()
      if (queue.length === 0) {
        relay?.stop()
      }
      return next ?? { snapshot: null, events: [] }
    }
  }
  relay = new ConversationEventRelay(orca, poster, ledger, () => {})
  await relay.run()
  return posts
}

const freshLedger = (): ThreadPostLedger =>
  new ThreadPostLedger(mkdtempSync(join(tmpdir(), 'orca-discord-')))

describe('ConversationEventRelay', () => {
  it('posts a live reply once, even when the next snapshot still shows it', async () => {
    const ended: ConversationEvent = {
      ...ref,
      kind: 'turn-ended',
      turnId: 7,
      stopReason: 'success',
      lastAssistantMessage: 'All tests pass.'
    }
    const posts = await relayWindows(
      [
        { snapshot: null, events: [ended] },
        { snapshot: idle(7, 'All tests pass.'), events: [] }
      ],
      freshLedger()
    )
    expect(posts).toEqual(['All tests pass.'])
  })

  it('recovers a reply missed while the bridge was down, but not again after a restart', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'orca-discord-'))
    const first = await relayWindows(
      [{ snapshot: idle(9, 'Finished the refactor.'), events: [] }],
      new ThreadPostLedger(dir)
    )
    const afterRestart = await relayWindows(
      [{ snapshot: idle(9, 'Finished the refactor.'), events: [] }],
      new ThreadPostLedger(dir)
    )
    expect(first).toEqual(['Finished the refactor.'])
    expect(afterRestart).toEqual([])
  })

  it('retries a reply whose post failed on the next snapshot', async () => {
    const posts = await relayWindows(
      [
        { snapshot: idle(3, 'Done.'), events: [] },
        { snapshot: idle(3, 'Done.'), events: [] }
      ],
      freshLedger(),
      1
    )
    expect(posts).toEqual(['Done.'])
  })

  it('posts a prompt card once across its event and later snapshots', async () => {
    const waiting: ConversationSnapshot = {
      kind: 'snapshot',
      conversations: [{ ...ref, working: false, prompt: APPROVAL, turnId: null }]
    }
    const posts = await relayWindows(
      [
        {
          snapshot: null,
          events: [{ ...ref, kind: 'prompt', prompt: APPROVAL }]
        },
        { snapshot: waiting, events: [] }
      ],
      freshLedger()
    )
    expect(posts).toEqual(['prompt:p_1'])
  })

  it('ignores conversations from other connector sources', async () => {
    const slack = {
      ...ref,
      conversation: { source: 'slack', externalId: 'C1' }
    }
    const posts = await relayWindows(
      [
        {
          snapshot: null,
          events: [{ ...slack, kind: 'turn-ended', turnId: 1, stopReason: 'success' }]
        }
      ],
      freshLedger()
    )
    expect(posts).toEqual([])
  })
})
