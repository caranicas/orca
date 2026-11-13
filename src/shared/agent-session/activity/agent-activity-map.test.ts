import { describe, expect, it } from 'vitest'
import { projectAgentActivityMap } from './agent-activity-map'
import type {
  AgentJournalItemBody,
  AgentJournalRenderItem
} from '../journal/agent-session-journal-types'

function row(
  sequence: number,
  body: AgentJournalItemBody,
  extra: Partial<AgentJournalRenderItem> = {}
): AgentJournalRenderItem {
  return {
    itemId: `item-${sequence}`,
    revision: 1,
    sequence,
    observedAt: sequence * 1000,
    body,
    ...extra
  }
}

describe('projectAgentActivityMap', () => {
  it('uses the shared tool vocabulary for Claude and Codex calls without retaining their contents', () => {
    const result = projectAgentActivityMap([
      row(1, {
        kind: 'tool-call',
        name: 'Read',
        input: { file_path: 'C:\\project\\src\\app.ts', content: 'private content' },
        state: 'completed'
      }),
      row(2, {
        kind: 'tool-call',
        name: 'read',
        input: { path: '/project/src/app.ts', command: 'cat /project/src/app.ts' },
        state: 'completed'
      }),
      row(3, {
        kind: 'tool-call',
        name: 'exec_command',
        input: { cmd: 'export SECRET=private-value' },
        state: 'running'
      }),
      row(4, {
        kind: 'tool-call',
        name: 'PowerShell',
        input: { command: '$secret = "private-value"' },
        state: 'completed'
      }),
      row(5, {
        kind: 'tool-call',
        name: 'WebFetch',
        input: { url: 'https://user:password@example.com/private?token=secret' },
        state: 'completed'
      })
    ])
    expect(result.map(({ station, label }) => ({ station, label }))).toEqual([
      { station: 'files', label: 'src/app.ts' },
      { station: 'files', label: 'src/app.ts' },
      { station: 'shell', label: 'exec_command' },
      { station: 'shell', label: 'PowerShell' },
      { station: 'network', label: 'example.com' }
    ])
    expect(JSON.stringify(result)).not.toMatch(/private|password|token=|cat |SECRET/)
  })

  it('reads actual lifecycles, including interruptions and unconfirmed ends', () => {
    const result = projectAgentActivityMap([
      row(1, { kind: 'tool-call', name: 'Bash', input: {}, state: 'running' }),
      row(2, { kind: 'tool-call', name: 'Bash', input: {}, state: 'failed' }),
      row(3, {
        kind: 'tool-call',
        name: 'Bash',
        input: {},
        state: 'failed',
        endedAs: 'interrupted'
      }),
      row(4, {
        kind: 'tool-call',
        name: 'Bash',
        input: {},
        state: 'failed',
        endedAs: 'unverifiable'
      }),
      row(5, { kind: 'tool-call', name: 'Bash', input: {}, state: 'completed', durationMs: 1200 })
    ])
    expect(result.map((event) => event.state)).toEqual([
      'running',
      'failed',
      'interrupted',
      'unknown',
      'completed'
    ])
    expect(result[4]).toMatchObject({ id: 'item-5', durationMs: 1200 })
  })

  it('classifies named memory, skills, MCP browsers and collaboration while preserving producer origins', () => {
    const result = projectAgentActivityMap([
      row(1, {
        kind: 'tool-call',
        name: 'Read',
        input: { file_path: '/repo/.agents/skills/review/SKILL.md' },
        state: 'completed'
      }),
      row(2, {
        kind: 'tool-call',
        name: 'Read',
        input: { file_path: '/repo/AGENTS.md' },
        state: 'completed'
      }),
      row(
        3,
        {
          kind: 'tool-call',
          name: 'fetch',
          mcpIdentity: { server: 'playwright', tool: 'snapshot' },
          input: {},
          state: 'running'
        },
        { agentId: 'child' }
      ),
      row(4, {
        kind: 'tool-call',
        name: 'mcp__memory__search',
        input: { query: 'secret' },
        state: 'completed'
      }),
      row(5, {
        kind: 'tool-call',
        name: 'spawn_agent',
        input: { prompt: 'secret' },
        state: 'completed'
      }),
      row(
        6,
        { kind: 'tool-call', name: 'exec_command', input: {}, state: 'running' },
        { agentId: 'background-command', producerKind: 'background' }
      )
    ])
    expect(result.map(({ station, origin }) => ({ station, origin }))).toEqual([
      { station: 'skills', origin: 'core' },
      { station: 'memory', origin: 'core' },
      { station: 'browser', origin: 'agents' },
      { station: 'memory', origin: 'core' },
      { station: 'agents', origin: 'core' },
      { station: 'shell', origin: 'core' }
    ])
  })

  it('places approvals at You and does not invent model steps from a running turn', () => {
    const resolution = {
      state: 'pending',
      selectedOptionId: null,
      resolvedBy: null,
      resolvedAt: null
    } as const
    const result = projectAgentActivityMap([
      row(1, { kind: 'turn', turnId: 'turn-1', state: 'running' }),
      row(2, {
        kind: 'approval',
        title: 'Contains private data',
        detail: 'secret',
        options: [],
        resolution
      }),
      row(3, {
        kind: 'message',
        role: 'reasoning',
        blocks: [{ type: 'text', text: 'secret' }],
        state: 'running'
      }),
      row(4, { kind: 'message', role: 'assistant', blocks: [{ type: 'text', text: 'secret' }] })
    ])
    expect(result.map(({ id, station, state }) => ({ id, station, state }))).toEqual([
      { id: 'item-2', station: 'you', state: 'waiting' },
      { id: 'item-3', station: 'model', state: 'running' }
    ])
    expect(JSON.stringify(result)).not.toMatch(/secret|private/)
  })

  it('uses journal order across clock skew and replaces a running call with its revised snapshot', () => {
    const first = row(
      1,
      { kind: 'tool-call', name: 'Read', input: {}, state: 'running' },
      { observedAt: 9000 }
    )
    const second = row(
      2,
      { kind: 'tool-call', name: 'Bash', input: {}, state: 'completed' },
      { observedAt: 1000 }
    )
    const revised = {
      ...first,
      revision: 2,
      body: { kind: 'tool-call', name: 'Read', input: {}, state: 'completed' } as const
    }
    expect(projectAgentActivityMap([first])[0]?.state).toBe('running')
    expect(
      projectAgentActivityMap([second, revised]).map(({ id, state }) => ({ id, state }))
    ).toEqual([
      { id: 'item-1', state: 'completed' },
      { id: 'item-2', state: 'completed' }
    ])
  })
})
