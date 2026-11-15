import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { AGENT_JOURNAL_THREAD_SCOPE } from '../../../../../../shared/agent-session/journal/agent-session-journal-types'
import { codexProviderHandle } from '../../../../../../shared/agent-session/lifecycle/agent-session-provider-handle-encoding'

import {
  createTrackedJournalOpener,
  openTestJournalHostDatabase
} from '../../../../agent-session-journal/store-lifecycle/journal-host-database-test-support'
import type { AgentSessionJournal } from '../../../../agent-session-journal/journal-store'

import {
  createAgentSessionCatchUpReader,
  readAgentSessionHistory
} from '../agent-session-history-page'
import { DEFAULT_ACTIVITY_MAP_PROVIDER_OPTIONS } from '../../../../../../shared/agent-session/activity/activity-map-provider-options'

const IDENTITY = {
  sessionId: 'session-1',
  workspaceId: 'ws-1',
  hostId: 'host-1',
  agent: 'codex' as const,
  providerHandle: codexProviderHandle('thread-1')
}
const journals = createTrackedJournalOpener({ legacyInputs: true })
let root: string
let journal: AgentSessionJournal
const item = (ordinal: number) => ({
  provider: 'codex' as const,
  threadId: 'thread-1',
  turnId: 'turn-1',
  ordinal
})

it('reports whole-session activity with caller memory mappings outside a one-row page', async () => {
  const options = { fence: 1, turnScope: AGENT_JOURNAL_THREAD_SCOPE }
  await journal.appendItem(
    item(1),
    {
      kind: 'tool-call',
      name: 'Bash',
      input: { command: 'git status' },
      callId: 'git',
      state: 'completed'
    },
    options
  )
  await journal.appendItem(
    item(2),
    {
      kind: 'tool-call',
      name: 'Read',
      input: { file_path: '/work/notes/facts.txt' },
      callId: 'facts',
      state: 'running'
    },
    options
  )
  await journal.appendItem(
    item(2),
    {
      kind: 'tool-call',
      name: 'Read',
      input: { file_path: '/work/notes/facts.txt' },
      callId: 'facts',
      state: 'failed'
    },
    options
  )
  await journal.appendItem(
    item(3),
    { kind: 'message', role: 'user', blocks: [{ type: 'text', text: 'Try again' }] },
    options
  )
  const result = readAgentSessionHistory(journal, {
    sessionId: 'session-1',
    direction: 'tail',
    limit: 1,
    activityMapOptions: { ...DEFAULT_ACTIVITY_MAP_PROVIDER_OPTIONS, memoryPaths: ['/notes/'] }
  })
  expect(result.page.items.map((item) => item.body.kind)).toEqual(['message'])
  expect(result.page.activityMap?.statistics).toEqual({
    counts: { shell: 1, memory: 1, you: 1 },
    faults: {},
    clearedAt: expect.any(Number),
    pushed: 0
  })
  expect(result.page.activityMap?.events.find((event) => event.callId === 'facts')).toMatchObject({
    station: 'memory',
    state: 'failed'
  })
})

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-history-public-read-'))
  journal = await journals.open({ identity: IDENTITY, stateDirectory: root })
})
afterEach(async () => {
  await journals.closeAll()
  await rm(root, { recursive: true, force: true })
})

it('refreshes a retained catch-up reader after a same-cursor disk reload', async () => {
  const options = { fence: 1, turnScope: AGENT_JOURNAL_THREAD_SCOPE }
  await journal.appendItem(item(0), { kind: 'turn', turnId: 'turn-1', state: 'running' }, options)
  const view = journal.publicRead()
  expect(view.snapshot.items).toHaveLength(1)
  const cursor = journal.cursor()
  const read = createAgentSessionCatchUpReader(journal, undefined, view)
  const request = {
    sessionId: IDENTITY.sessionId,
    direction: 'after' as const,
    cursor: { epoch: cursor.epoch, sequence: 0 }
  }
  expect(read(request)).toMatchObject({
    ok: true,
    page: { items: [{ body: { state: 'running' } }], latestTurn: { turn: { state: 'running' } } }
  })
  openTestJournalHostDatabase(root)
    .db.prepare(
      "UPDATE journal_rows SET row_json = json_set(row_json, '$.body.state', 'completed') WHERE session_id = ? AND epoch = ? AND seq = ?"
    )
    .run(IDENTITY.sessionId, cursor.epoch, cursor.sequence)
  await journal.open()
  expect(journal.cursor()).toEqual(cursor)
  expect(read(request)).toMatchObject({
    ok: true,
    page: {
      items: [{ body: { state: 'completed' } }],
      latestTurn: { turn: { state: 'completed' } }
    }
  })
})
