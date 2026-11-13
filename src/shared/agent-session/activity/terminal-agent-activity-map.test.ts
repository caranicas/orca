import { describe, expect, it } from 'vitest'
import type { NativeChatMessage } from '../../native-chat/native-chat-types'
import { projectTerminalAgentActivityMap } from './terminal-agent-activity-map'

function message(
  id: string,
  role: NativeChatMessage['role'],
  blocks: NativeChatMessage['blocks'],
  agentId?: string
): NativeChatMessage {
  return {
    id,
    role,
    blocks,
    timestamp: 1000,
    source: 'transcript',
    ...(agentId ? { agentId } : {})
  }
}

describe('terminal activity projection', () => {
  it('pairs calls across transcript rows and exposes only short tool labels', () => {
    const events = projectTerminalAgentActivityMap([
      message('call', 'assistant', [
        {
          type: 'tool-call',
          name: 'Read',
          input: { file_path: 'C:\\project\\src\\index.ts', secret: 'private argument' },
          callId: 'read'
        },
        {
          type: 'tool-call',
          name: 'exec_command',
          input: { cmd: 'private command' },
          callId: 'shell'
        }
      ]),
      message('result', 'tool', [
        { type: 'tool-result', callId: 'shell', output: 'private output', isError: true },
        { type: 'tool-result', callId: 'read', output: 'private file content' }
      ])
    ])
    expect(events).toEqual([
      {
        id: 'call:tool:0',
        origin: 'core',
        startedAt: 1000,
        station: 'files',
        label: 'src/index.ts',
        state: 'completed'
      },
      {
        id: 'call:tool:1',
        origin: 'core',
        startedAt: 1000,
        station: 'shell',
        label: 'exec_command',
        state: 'failed'
      }
    ])
  })

  it('keeps missing results unconfirmed across turns and producer boundaries', () => {
    const events = projectTerminalAgentActivityMap([
      message('old', 'assistant', [
        { type: 'tool-call', name: 'Read', input: {}, callId: 'reused' }
      ]),
      message('prompt', 'user', [{ type: 'text', text: 'next task' }]),
      message(
        'child',
        'assistant',
        [{ type: 'tool-call', name: 'Read', input: {}, callId: 'reused' }],
        'reviewer'
      ),
      message('result', 'tool', [{ type: 'tool-result', callId: 'reused', output: 'unrelated' }])
    ])
    expect(events.map(({ id, state, origin }) => ({ id, state, origin }))).toEqual([
      { id: 'old:tool:0', state: 'unknown', origin: 'core' },
      { id: 'prompt', state: 'observed', origin: 'core' },
      { id: 'child:tool:0', state: 'unknown', origin: 'agents' }
    ])
  })

  it('does not invent user messages from Claude result envelopes', () => {
    expect(
      projectTerminalAgentActivityMap([
        message('call', 'assistant', [
          { type: 'tool-call', name: 'Bash', input: {}, state: 'running', callId: 'shell' }
        ]),
        message('result', 'user', [{ type: 'tool-result', output: 'ok', callId: 'shell' }])
      ])
    ).toEqual([
      {
        id: 'call:tool:0',
        origin: 'core',
        startedAt: 1000,
        station: 'shell',
        label: 'Bash',
        state: 'completed'
      }
    ])
  })

  it('preserves reported reasoning and interrupted or unverifiable calls', () => {
    expect(
      projectTerminalAgentActivityMap([
        message('thought', 'reasoning', [{ type: 'text', text: 'private reasoning' }]),
        message('calls', 'assistant', [
          { type: 'tool-call', name: 'Bash', input: {}, state: 'failed', endedAs: 'interrupted' },
          { type: 'tool-call', name: 'Read', input: {}, state: 'failed', endedAs: 'unverifiable' }
        ])
      ])
    ).toEqual([
      {
        id: 'thought',
        origin: 'core',
        startedAt: 1000,
        station: 'model',
        label: 'Reasoning',
        state: 'observed'
      },
      {
        id: 'calls:tool:0',
        origin: 'core',
        startedAt: 1000,
        station: 'shell',
        label: 'Bash',
        state: 'interrupted'
      },
      {
        id: 'calls:tool:1',
        origin: 'core',
        startedAt: 1000,
        station: 'files',
        label: 'Read',
        state: 'unknown'
      }
    ])
  })
})
