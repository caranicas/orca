import { runInNewContext } from 'node:vm'
import { expect, it } from 'vitest'
import { CLAUDE_ACTIVITY_ONLY_MOD_SOURCE } from './agent-view-plugin'
import { activityMapHookEvent } from '../../../shared/agent-session/activity/activity-map-hook-event'

type Handler = (api: unknown, event: unknown, next: (event: unknown) => unknown) => unknown

function observer(offline = false) {
  const handlers = new Map<string, Handler>()
  const register = runInNewContext(
    `${CLAUDE_ACTIVITY_ONLY_MOD_SOURCE.replace('export function register', 'function register')}\nregister`
  )
  register((name: string, matcher: Handler | { door: string }, handler?: Handler) => {
    if (handler) {
      handlers.set(name, handler)
    } else if (typeof matcher === 'function') {
      handlers.set(name, matcher)
    }
  })
  const delivered: { paneKey: string; payload: Record<string, unknown> }[] = []
  const api = {
    session: {
      id: async () => 'claude-session',
      model: async () => 'claude-sonnet-4-6',
      usage: async () => ({ context: { tokens: 75000, window: 200000, percent: 38 } })
    },
    clock: { now: async () => 1000 },
    env: {
      get: async (name: string) =>
        ({
          ORCA_PANE_KEY: 'tab:pane',
          ORCA_AGENT_HOOK_PORT: '1234',
          ORCA_AGENT_HOOK_TOKEN: 'test'
        })[name]
    },
    http: {
      fetch: async (_url: string, init: { body: string }) => {
        if (offline) {
          throw new Error('Disconnected')
        }
        delivered.push(JSON.parse(init.body))
        return { ok: true }
      }
    }
  }
  const flush = async () => {
    await new Promise<void>((resolve) => setImmediate(resolve))
  }
  const invoke = (name: string, event: unknown, next: (event: unknown) => unknown) =>
    handlers.get(name)!(api, event, next)
  return { invoke, delivered, flush }
}

it('observes a child tool failure without changing its input, output or owning session', async () => {
  const map = observer()
  const input = { tool: 'Bash', tool_use_id: 'call-a', command: 'git status', agentId: 'child-a' }
  const output = { result: { exit_code: 2 }, isError: true }
  expect(
    await map.invoke('tool.call', input, (received) => {
      expect(received).toBe(input)
      return output
    })
  ).toBe(output)
  await map.flush()
  const facts = map.delivered.map((row) => {
    expect(row.paneKey).toBe('tab:pane')
    const payload = row.payload
    expect(payload.session_id).toBe('claude-session')
    return activityMapHookEvent('OrcaActivity', payload)
  })
  expect(facts).toMatchObject([
    { callId: 'call-a', agentId: 'child-a', origin: 'agents', station: 'shell', state: 'running' },
    { callId: 'call-a', agentId: 'child-a', origin: 'agents', station: 'shell', state: 'failed' }
  ])
})

it('preserves streamed model chunks and associates a recorded response with its explicit request', async () => {
  const map = observer()
  const step = { turnId: 'turn-a', index: 0, model: 'claude-sonnet-4-6' }
  const text = { kind: 'text', index: 0, text: 'The answer' }
  const result = { stopReason: 'end_turn', usage: {} }
  const stream = map.invoke('turn.step', step, async function* (received) {
    expect(received).toBe(step)
    yield text
    const appended = { uuid: 'transcript-a', message: {} }
    expect(await map.invoke('session.append', { door: 'response' }, () => appended)).toBe(appended)
    return result
  })
  if (
    !stream ||
    typeof stream !== 'object' ||
    !('next' in stream) ||
    typeof stream.next !== 'function'
  ) {
    throw new Error('The model observer did not return its stream')
  }
  expect((await stream.next()).value).toBe(text)
  expect((await stream.next()).value).toBe(result)
  await map.flush()
  const payloads = map.delivered.map((row) => row.payload)
  const facts = payloads.map((payload) => activityMapHookEvent('OrcaActivity', payload))
  expect(facts.findLast((fact) => fact?.mark === 'step')).toMatchObject({
    state: 'completed',
    transcriptIds: ['transcript-a']
  })
  expect(facts.findLast((fact) => fact?.context?.usage)).toMatchObject({
    context: {
      model: 'claude-sonnet-4-6',
      usage: { usedTokens: 75000, windowTokens: 200000, percentage: 38, estimated: false }
    }
  })
})

it('keeps tools and aborted compaction usable when Orca cannot receive observations', async () => {
  const map = observer(true)
  const result = { skip: 'Cancelled', messages: undefined }
  expect(await map.invoke('session.compact', { trigger: 'manual' }, () => result)).toBe(result)
  const failure = new Error('Tool failed')
  await expect(
    map.invoke('tool.call', { tool: 'Read', file_path: 'a.ts' }, () => {
      throw failure
    })
  ).rejects.toBe(failure)
  await map.flush()
})
