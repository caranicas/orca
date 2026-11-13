import { defineFixture } from '../../../component-fixtures/component-fixture'
import { NativeChatActivityMap } from './NativeChatActivityMap'
import { NativeChatActivityMapLayout } from './NativeChatActivityMapLayout'
import type {
  AgentJournalItemBody,
  AgentJournalRenderItem
} from '../../../../../shared/agent-session/journal/agent-session-journal-types'
import type { StructuredAgentSubagentRoster } from '../../../../../shared/agent-session/view/structured-agent-session-subagent-roster'

function row(
  sequence: number,
  body: AgentJournalItemBody,
  agentId?: string
): AgentJournalRenderItem {
  return {
    itemId: `map-${sequence}`,
    revision: 1,
    sequence,
    observedAt: 1000 * sequence,
    body,
    ...(agentId ? { agentId } : {})
  }
}

const ITEMS = [
  row(1, { kind: 'message', role: 'user', blocks: [{ type: 'text', text: 'Add project search' }] }),
  row(2, {
    kind: 'tool-call',
    name: 'Read',
    input: { file_path: '/repo/AGENTS.md' },
    state: 'completed',
    durationMs: 12
  }),
  row(3, {
    kind: 'tool-call',
    name: 'Read',
    input: { file_path: '/repo/src/search.ts' },
    state: 'completed',
    durationMs: 18
  }),
  row(4, {
    kind: 'tool-call',
    name: 'mcp__github__search',
    input: {},
    state: 'failed',
    durationMs: 1500
  }),
  row(5, { kind: 'tool-call', name: 'spawn_agent', input: {}, state: 'completed', durationMs: 80 }),
  row(6, {
    kind: 'tool-call',
    name: 'exec_command',
    input: { cmd: 'pnpm test' },
    state: 'running',
    durationMs: 5200
  }),
  row(
    7,
    {
      kind: 'tool-call',
      name: 'Read',
      input: { file_path: '/repo/src/search-index.ts' },
      state: 'running',
      durationMs: 800
    },
    'reviewer'
  )
]

const ROSTER: StructuredAgentSubagentRoster = new Map([
  [
    'reviewer',
    {
      entry: { id: 'reviewer', label: 'Review search', state: 'working' },
      rosterItemId: 'map-5',
      rosterPosition: { sequence: 5, index: 0 },
      rosterRevision: 1
    }
  ]
])
const CONTEXT = {
  usedTokens: 64000,
  windowTokens: 200000,
  percentage: 32,
  estimated: true,
  categories: []
}

export const working = defineFixture({
  width: 360,
  render: () => (
    <div className="native-chat-appearance h-160">
      <NativeChatActivityMap
        items={ITEMS}
        agentLabel="Codex"
        working
        live
        contextUsage={CONTEXT}
        subagentRoster={ROSTER}
        onClose={() => {}}
      />
    </div>
  )
})

export const empty = defineFixture({
  width: 320,
  render: () => (
    <div className="native-chat-appearance h-140">
      <NativeChatActivityMap
        items={[]}
        agentLabel="Claude"
        working={false}
        live
        contextUsage={null}
        subagentRoster={new Map()}
        onClose={() => {}}
      />
    </div>
  )
})

export const disconnected = defineFixture({
  width: 320,
  render: () => (
    <div className="native-chat-appearance h-160">
      <NativeChatActivityMap
        items={ITEMS}
        agentLabel="Codex"
        working
        live={false}
        contextUsage={null}
        subagentRoster={ROSTER}
        onClose={() => {}}
      />
    </div>
  )
})

function layout(width: number) {
  return defineFixture({
    width,
    render: () => (
      <div className="native-chat-appearance flex h-180 flex-col bg-background text-foreground">
        <NativeChatActivityMapLayout
          pane={{
            tabId: 'map-tab',
            groupId: 'map-group',
            sessionId: 'map-session',
            target: { kind: 'local' },
            agent: 'codex',
            isVisible: true,
            isFocusedGroup: true
          }}
          ownerWorktreeId="map-workspace"
          colorScheme={undefined}
          handOff={{
            available: false,
            preparing: false,
            open: () => {},
            reset: () => {},
            dialog: null
          }}
          controller={{
            journalItems: ITEMS,
            epoch: 'map-epoch',
            hostClock: null,
            contextClear: { clears: 0, clearing: false, rows: ITEMS, onClearSent: () => () => {} },
            isWorking: true,
            readCurrent: true,
            status: 'ready',
            contextUsage: CONTEXT,
            subagentRoster: ROSTER
          }}
          agentLabel="Codex"
          hostOnline
        >
          <div
            data-map-fixture-transcript=""
            className="flex min-w-0 flex-1 flex-col gap-4 p-6 text-sm"
          >
            <p className="font-semibold">Add project search</p>
            <p className="text-muted-foreground">
              Reading the search index and running the focused checks.
            </p>
          </div>
        </NativeChatActivityMapLayout>
        <div className="shrink-0 border-t border-border p-4 text-sm text-muted-foreground">
          Ask a follow-up
        </div>
      </div>
    ),
    interact: async (frame) => {
      frame.querySelector<HTMLButtonElement>('button[aria-label="Activity map"]')?.click()
    }
  })
}

export const desktop = layout(960)
export const narrow = layout(375)
