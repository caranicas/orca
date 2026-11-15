import { describe, expect, it } from 'vitest'
import {
  createTranscriptHookActivity,
  type TranscriptHookObservation
} from './transcript-hook-activity'
import { activityMapHookEvent } from '../../shared/agent-session/activity/activity-map-hook-event'
import { mergeTerminalActivity } from '../../shared/agent-session/activity/merge-terminal-activity'

function observer() {
  let receive: (row: TranscriptHookObservation) => void = () => {}
  const tracker = createTranscriptHookActivity({
    paneKey: 'tab:pane',
    sessionId: 'session',
    onChange: () => {},
    subscribe: (listener) => {
      receive = listener
      return () => {}
    }
  })
  const send = (name: string, id: string, overrides: Partial<TranscriptHookObservation> = {}) => {
    receive({
      paneKey: 'tab:pane',
      connectionId: null,
      providerSession: { key: 'session_id', id: 'session' },
      payload: { agentType: 'codex', state: 'working', prompt: '' },
      receivedAt: 1000,
      hookEventName: name,
      activityMapEvent: activityMapHookEvent(name, {
        tool_use_id: id,
        tool_name: 'Read',
        tool_input: { file_path: '/repo/src/a.ts' }
      }),
      ...overrides
    })
  }
  return { tracker, send }
}

describe('pane-scoped terminal activity', () => {
  it('rejects activity owned by another pane, host, session or replay generation', () => {
    const { tracker, send } = observer()
    send('PreToolUse', 'foreign-pane', { paneKey: 'tab:other' })
    send('PreToolUse', 'foreign-host', { connectionId: 'ssh:other' })
    send('PreToolUse', 'foreign-session', { providerSession: { key: 'session_id', id: 'other' } })
    send('PreToolUse', 'replayed', { isReplay: true })
    expect(tracker.events()).toEqual([])
    send('PreToolUse', 'owned')
    expect(tracker.events()).toMatchObject([
      { callId: 'owned', state: 'running', station: 'files' }
    ])
  })

  it('resolves one concurrent call without settling another or duplicating its transcript result', () => {
    const { tracker, send } = observer()
    send('PreToolUse', 'a')
    send('PreToolUse', 'b')
    send('PostToolUse', 'a', { receivedAt: 1500 })
    expect(tracker.events().find((row) => row.callId === 'b')?.state).toBe('running')
    const result = mergeTerminalActivity(
      [
        {
          id: 'result',
          callId: 'a',
          origin: 'core',
          station: 'files',
          label: 'src/a.ts',
          state: 'failed',
          startedAt: 1000
        }
      ],
      tracker.events(),
      []
    )
    expect(result.filter((row) => row.callId === 'a')).toMatchObject([{ state: 'failed' }])
    expect(result.find((row) => row.callId === 'b')?.state).toBe('running')
  })

  it('keeps background work open at interruption and discards the previous session on reset', () => {
    const { tracker, send } = observer()
    send('PreToolUse', 'foreground')
    send('PreToolUse', 'background', {
      activityMapEvent: {
        id: 'background',
        callId: 'background',
        taskId: 'task',
        station: 'shell',
        origin: 'core',
        label: 'node',
        state: 'running',
        startedAt: 0
      }
    })
    send('Interrupt', 'stop')
    expect(tracker.events().find((row) => row.callId === 'foreground')?.state).toBe('interrupted')
    expect(tracker.events().find((row) => row.callId === 'background')?.state).toBe('running')
    tracker.reset()
    expect(tracker.events()).toEqual([])
  })
})
