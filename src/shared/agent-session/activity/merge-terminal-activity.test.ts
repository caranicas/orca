import { expect, it } from 'vitest'
import { mergeTerminalActivity } from './merge-terminal-activity'
import type { ActivityMapEvent } from './agent-activity-map'

it('updates the current agent invocation without reopening the completed previous invocation', () => {
  const calls: ActivityMapEvent[] = [
    {
      id: 'old',
      callId: 'old-call',
      taskId: 'agent-a',
      station: 'agents',
      origin: 'core',
      label: 'Earlier request',
      state: 'completed',
      startedAt: 10,
      endedAt: 20,
      durationMs: 10
    },
    {
      id: 'current',
      callId: 'new-call',
      taskId: 'agent-a',
      station: 'agents',
      origin: 'core',
      label: 'Current request',
      state: 'running',
      startedAt: 100
    }
  ]
  const child: ActivityMapEvent = {
    id: 'child',
    callId: 'new-call',
    taskId: 'agent-a',
    mark: 'child',
    station: 'agents',
    origin: 'core',
    label: 'Agent',
    state: 'running',
    startedAt: 105
  }
  expect(mergeTerminalActivity(calls, [], [child])).toMatchObject([
    { callId: 'old-call', state: 'completed', durationMs: 10 },
    { callId: 'new-call', state: 'running', label: 'Current request' }
  ])
})

it('retains an observed tool failure when a later child snapshot has an unknown outcome', () => {
  const call: ActivityMapEvent = {
    id: 'call',
    callId: 'launch',
    taskId: 'agent-a',
    station: 'agents',
    origin: 'core',
    label: 'Launch agent',
    state: 'failed',
    startedAt: 100,
    endedAt: 110
  }
  const child: ActivityMapEvent = {
    id: 'child',
    callId: 'launch',
    taskId: 'agent-a',
    mark: 'child',
    station: 'agents',
    origin: 'core',
    label: 'Agent',
    state: 'unknown',
    startedAt: 105
  }
  expect(
    mergeTerminalActivity([call], [], [child]).find((event) => event.mark !== 'child')?.state
  ).toBe('failed')
})
