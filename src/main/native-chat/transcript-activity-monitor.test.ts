import { expect, it } from 'vitest'
import { createTranscriptActivityMonitor } from './transcript-activity-monitor'
import type { TranscriptHookObservation } from './transcript-hook-activity'
import type { ActivityMapEvent } from '../../shared/agent-session/activity/agent-activity-map'
import { ClaudeAgentViewBridge } from '../claude/agent-view/agent-view-bridge'

function monitor(agent: 'codex' | 'claude' = 'codex') {
  let receive: (row: TranscriptHookObservation) => void = () => {}
  const activity = createTranscriptActivityMonitor(
    {
      agent,
      paneKey: 'tab:pane',
      sessionId: 'session',
      onAppend: () => {},
      subscribeActivity: (listener) => {
        receive = listener
        return () => {}
      }
    },
    () => {}
  )
  const send = (event: ActivityMapEvent) =>
    receive({
      paneKey: 'tab:pane',
      connectionId: null,
      providerSession: { key: 'session_id', id: 'session' },
      receivedAt: 2000,
      hookEventName: 'OrcaActivity',
      activityMapEvent: event,
      payload: { agentType: agent, state: 'working', prompt: '' }
    })
  return { activity, send }
}

it('keeps session totals after feed eviction and merges a delayed transcript result once', () => {
  const { activity, send } = monitor()
  try {
    for (let index = 0; index < 100; index++) {
      send({
        id: `tool-${index}`,
        callId: `tool-${index}`,
        station: 'shell',
        label: 'git status',
        origin: 'core',
        state: 'completed',
        startedAt: 1000,
        endedAt: 1100
      })
    }
    expect(activity.snapshot().statistics?.counts.shell).toBe(100)
    activity.observe(
      JSON.stringify({
        type: 'event_msg',
        payload: {
          type: 'item_completed',
          item: {
            type: 'CommandExecution',
            id: 'tool-0',
            command: ['git', 'status'],
            status: 'completed',
            exit_code: 0
          }
        }
      }),
      'late-result'
    )
    expect(activity.snapshot().statistics?.counts.shell).toBe(100)
    expect(activity.snapshot().events.find((row) => row.callId === 'tool-99')?.state).toBe(
      'completed'
    )
    activity.reset()
    expect(activity.snapshot().statistics?.counts.shell).toBeUndefined()
  } finally {
    activity.dispose()
  }
})

it('uses the transcript identity to count a Claude response and its live step once', () => {
  const { activity, send } = monitor('claude')
  try {
    send({
      id: 'step-a',
      mark: 'step',
      station: 'model',
      label: 'sonnet 4.6 · step 1',
      origin: 'core',
      state: 'running',
      startedAt: 1000
    })
    expect(activity.snapshot().statistics?.counts.model).toBe(1)
    activity.observe(
      JSON.stringify({
        type: 'assistant',
        uuid: 'row-a',
        timestamp: '2026-11-14T00:00:00Z',
        message: {
          id: 'response-a',
          model: 'claude-sonnet-4-6',
          stop_reason: 'end_turn',
          usage: { input_tokens: 100 }
        }
      }),
      'response'
    )
    send({
      id: 'step-a',
      mark: 'step',
      transcriptIds: ['row-a'],
      station: 'model',
      label: 'sonnet 4.6 · step 1',
      origin: 'core',
      state: 'completed',
      startedAt: 1000,
      endedAt: 2000,
      durationMs: 1000
    })
    const snapshot = activity.snapshot()
    expect(snapshot.statistics?.counts.model).toBe(1)
    expect(snapshot.events.filter((row) => row.mark === 'step')).toMatchObject([
      { state: 'completed', durationMs: 1000, transcriptIds: ['row-a'] }
    ])
  } finally {
    activity.dispose()
  }
})

it('retains native Claude activity before the first prompt and across closing the map', () => {
  const paneKey = 'tab:11111111-1111-4111-8111-111111111111'
  const bridge = new ClaudeAgentViewBridge()
  bridge.receive({
    action: 'activity',
    paneKey,
    payload: {
      session_id: 'before-first-prompt',
      activity: {
        id: 'startup-memory',
        station: 'hooks',
        label: 'Context added at start',
        origin: 'core',
        state: 'completed',
        startedAt: 1000
      }
    }
  })
  const args = {
    agent: 'claude' as const,
    paneKey,
    sessionId: 'before-first-prompt',
    onAppend: () => {}
  }
  const first = createTranscriptActivityMonitor(args, () => {})
  expect(first.snapshot().events).toMatchObject([{ station: 'hooks', state: 'completed' }])
  first.dispose()
  const reopened = createTranscriptActivityMonitor(args, () => {})
  try {
    expect(reopened.snapshot().statistics?.counts.hooks).toBe(1)
    bridge.receive({
      action: 'activity',
      paneKey,
      payload: {
        session_id: 'different-session',
        activity: {
          id: 'foreign',
          station: 'shell',
          label: 'git status',
          origin: 'core',
          state: 'running',
          startedAt: 2000
        }
      }
    })
    expect(reopened.snapshot().events).toMatchObject([{ station: 'hooks', state: 'completed' }])
  } finally {
    reopened.dispose()
  }
})
