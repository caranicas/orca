import { describe, expect, it } from 'vitest'
import { createTranscriptActivityReader } from './transcript-activity-reader'
import { readClaudeStatuslineContext } from '../claude/statusline-context'

const usage = (used: number, cached = 45_824) =>
  JSON.stringify({
    timestamp: '2026-11-13T12:00:01Z',
    type: 'event_msg',
    payload: {
      type: 'token_count',
      info: {
        total_token_usage: { input_tokens: 362_963, total_tokens: 364_137 },
        last_token_usage: {
          input_tokens: used - 53,
          cached_input_tokens: cached,
          output_tokens: 53,
          total_tokens: used
        },
        model_context_window: 475_000
      }
    }
  })
const model = (name: string) =>
  JSON.stringify({
    timestamp: '2026-11-13T12:00:00Z',
    type: 'turn_context',
    payload: { model: name }
  })

it.each([
  {
    type: 'task_complete',
    outcome: { last_agent_message: 'Finished' },
    state: 'completed',
    mark: 'done'
  },
  {
    type: 'task_complete',
    outcome: { last_agent_message: null },
    state: 'completed',
    mark: undefined
  },
  { type: 'turn_complete', outcome: {}, state: 'completed', mark: undefined },
  { type: 'turn_aborted', outcome: {}, state: 'interrupted', mark: 'interrupted' },
  {
    type: 'turn_complete',
    outcome: { error: { message: 'Failed' } },
    state: 'failed',
    mark: undefined
  }
])(
  'reconciles a recorded turn start with $type without inventing a model request',
  ({ type, outcome, state, mark }) => {
    const reader = createTranscriptActivityReader('codex')
    reader.observe(
      JSON.stringify({
        type: 'event_msg',
        timestamp: '2026-11-15T22:57:23.695Z',
        payload: { type: 'task_started', turn_id: 'turn-1' }
      }),
      'start-record'
    )
    expect(reader.snapshot().events).toMatchObject([
      { id: 'turn:turn-1', station: 'you', state: 'running', inbound: true }
    ])
    reader.observe(
      JSON.stringify({
        type: 'event_msg',
        timestamp: '2026-11-15T22:57:29.000Z',
        payload: { type, turn_id: 'turn-1', ...outcome }
      }),
      'end-record'
    )
    expect(reader.snapshot().events).toMatchObject([
      { id: 'turn:turn-1', station: 'you', state, mark, inbound: false }
    ])
  }
)

describe('terminal provider context accounting', () => {
  it('counts the retained-context record and its uniquely enclosing compaction item once', () => {
    const reader = createTranscriptActivityReader('codex')
    reader.observe(
      JSON.stringify({
        type: 'compacted',
        timestamp: '2026-11-15T10:00:04Z',
        payload: { window_id: 'window-1' }
      }),
      'retained'
    )
    reader.observe(
      JSON.stringify({
        type: 'event_msg',
        timestamp: '2026-11-15T10:00:04.020Z',
        payload: {
          type: 'item_completed',
          started_at_ms: 1794736800000,
          completed_at_ms: 1794736804020,
          item: { type: 'ContextCompaction', id: 'compact-1' }
        }
      }),
      'item'
    )
    expect(reader.snapshot().events.filter((event) => event.mark === 'compact')).toEqual([
      expect.objectContaining({ state: 'completed', durationMs: 4020 })
    ])
    expect(reader.snapshot().statistics?.counts).toEqual({ model: 1 })
  })
  it('keeps an explicit code-mode failure separate from unreported inner tool outcomes', () => {
    const reader = createTranscriptActivityReader('codex')
    reader.observe(
      JSON.stringify({
        type: 'response_item',
        timestamp: '2026-11-15T19:22:31Z',
        payload: {
          type: 'custom_tool_call',
          call_id: 'code-1',
          name: 'exec',
          input: 'text(await tools.exec_command({cmd:"exit 7"}))'
        }
      }),
      'script'
    )
    reader.observe(
      JSON.stringify({
        type: 'response_item',
        timestamp: '2026-11-15T19:22:32Z',
        payload: {
          type: 'custom_tool_call_output',
          call_id: 'code-1',
          output: [
            { type: 'input_text', text: 'Script failed\nWall time 0.2 seconds\nOutput:\n' },
            { type: 'input_text', text: 'Script error:\nexec_command failed: blocked by policy' }
          ]
        }
      }),
      'result'
    )
    expect(reader.snapshot().events).toEqual([
      expect.objectContaining({
        callId: 'code-1',
        durationMs: 200,
        state: 'failed',
        station: 'shell'
      })
    ])
    expect(reader.snapshot().statistics?.faults).toEqual({ shell: 1 })
  })
  it('matches Codex status-line accounting without adding cached input or using cumulative spend', () => {
    const reader = createTranscriptActivityReader('codex')
    reader.observe(model('gpt-6.1-sol'), 'model')
    reader.observe(usage(47_511), 'usage')
    expect(reader.snapshot()).toMatchObject({
      model: 'gpt-6.1-sol',
      contextUsage: { usedTokens: 47_511, windowTokens: 475_000, percentage: 8, estimated: true }
    })
  })

  it('invalidates old measurements at compaction and model changes, then accepts a new report', () => {
    const reader = createTranscriptActivityReader('codex')
    reader.observe(model('gpt-6.1-sol'), 'model')
    reader.observe(usage(223_975), 'usage')
    expect(reader.snapshot().contextUsage?.percentage).toBe(46)
    reader.observe(JSON.stringify({ type: 'compacted', payload: {} }), 'compact')
    expect(reader.snapshot().contextUsage).toBeNull()
    reader.observe(usage(47_511), 'new-usage')
    reader.observe(model('gpt-6.1-astra'), 'new-model')
    expect(reader.snapshot()).toMatchObject({ model: 'gpt-6.1-astra', contextUsage: null })
    reader.observe(usage(47_511), 'next-usage')
    expect(reader.snapshot().contextUsage?.percentage).toBe(8)
  })

  it('reconstructs the newest facts from a reverse tail without restoring pre-compaction usage', () => {
    const reader = createTranscriptActivityReader('codex')
    reader.observe(JSON.stringify({ type: 'compacted', payload: {} }), 'compact', true)
    reader.observe(usage(223_975), 'usage', true)
    reader.observe(model('gpt-6.1-sol'), 'model', true)
    expect(reader.snapshot()).toMatchObject({ model: 'gpt-6.1-sol', contextUsage: null })
  })

  it('does not treat rate-limit updates or reasoning as model requests', () => {
    const reader = createTranscriptActivityReader('codex')
    reader.observe(model('gpt-6.1-sol'), 'model')
    reader.observe(usage(47_511), 'usage')
    reader.observe(
      JSON.stringify({ type: 'event_msg', payload: { type: 'token_count', info: null } }),
      'rate'
    )
    reader.observe(
      JSON.stringify({
        type: 'response_item',
        payload: { type: 'reasoning', summary: [{ text: 'Thinking' }] }
      }),
      'reasoning'
    )
    expect(reader.snapshot().contextUsage?.percentage).toBe(8)
    expect(reader.snapshot().events).toEqual([])
    reader.observe(
      JSON.stringify({ type: 'token_usage_record', payload: { response_id: 'response-1' } }),
      'response'
    )
    reader.observe(
      JSON.stringify({ type: 'token_usage_record', payload: { response_id: 'response-1' } }),
      'duplicate'
    )
    expect(reader.snapshot().events).toMatchObject([
      { id: 'model:response-1', state: 'completed', mark: 'step' }
    ])
  })

  it('uses Claude reported context and disjoint cache counters, retaining the verified capacity for later responses', () => {
    const reader = createTranscriptActivityReader('claude')
    const report = readClaudeStatuslineContext({
      paneKey: 'tab:pane',
      payload: JSON.stringify({
        session_id: 'session',
        model: { id: 'claude-opus-4-6' },
        context_window: {
          context_window_size: 200000,
          used_percentage: 7.75,
          current_usage: {
            input_tokens: 8500,
            cache_creation_input_tokens: 5000,
            cache_read_input_tokens: 2000,
            output_tokens: 1200
          }
        }
      })
    })
    expect(report).not.toBeNull()
    reader.observeContextReport(report!)
    expect(reader.snapshot().contextUsage).toMatchObject({
      usedTokens: 15500,
      percentage: 7.75,
      estimated: false
    })
    reader.observe(
      JSON.stringify({
        type: 'assistant',
        timestamp: '2026-11-14T12:00:00Z',
        message: {
          id: 'next',
          model: 'claude-opus-4-6',
          usage: { input_tokens: 10000, cache_read_input_tokens: 30000, output_tokens: 8000 }
        }
      }),
      'next'
    )
    expect(reader.snapshot().contextUsage).toMatchObject({
      usedTokens: 40000,
      windowTokens: 200000,
      percentage: 20,
      estimated: true
    })
    reader.observe(JSON.stringify({ type: 'system', subtype: 'compact_boundary' }), 'compact')
    expect(reader.snapshot().contextUsage).toBeNull()
  })

  it('does not size Claude from another model or overwrite main-thread usage with sidechain usage', () => {
    const reader = createTranscriptActivityReader('claude')
    reader.observe(
      JSON.stringify({
        type: 'assistant',
        message: { id: 'main', model: 'claude-opus-4-6', usage: { input_tokens: 40000 } }
      }),
      'main'
    )
    reader.observe(
      JSON.stringify({
        type: 'result',
        modelUsage: { 'claude-haiku-4-5': { contextWindow: 1000000 } }
      }),
      'side-window'
    )
    reader.observe(
      JSON.stringify({
        type: 'assistant',
        isSidechain: true,
        message: { id: 'child', model: 'claude-haiku-4-5', usage: { input_tokens: 1000 } }
      }),
      'child'
    )
    expect(reader.snapshot()).toMatchObject({ model: 'claude-opus-4-6', contextUsage: null })
    reader.observe(
      JSON.stringify({
        type: 'result',
        modelUsage: { 'claude-opus-4-6': { contextWindow: 200000 } }
      }),
      'main-window'
    )
    expect(reader.snapshot().contextUsage).toMatchObject({ usedTokens: 40000, percentage: 20 })
  })
  it('decodes nested Codex command failures and unsuccessful turn completion without announcing an answer', () => {
    const reader = createTranscriptActivityReader('codex')
    reader.observe(
      JSON.stringify({
        type: 'event_msg',
        payload: {
          type: 'item_completed',
          item: {
            type: 'CommandExecution',
            id: 'exec-1',
            command: ['pwsh.exe', '-Command', 'Get-Content src/main.ts'],
            status: 'failed',
            exit_code: 1
          }
        }
      }),
      'exec'
    )
    reader.observe(
      JSON.stringify({
        type: 'event_msg',
        payload: { type: 'turn_complete', turn_id: 'turn-1', error: { message: 'Failed' } }
      }),
      'end'
    )
    expect(reader.snapshot().events).toMatchObject([
      { callId: 'exec-1', station: 'files', state: 'failed' },
      { station: 'you', state: 'failed', mark: undefined }
    ])
  })
})

it.each([
  ['aborted by user after 0.1s', 100],
  ['Wall time: 0.3 seconds\naborted by user', 300],
  ['aborted before dispatch', undefined]
])('retains Codex cancellation as interrupted rather than successful: %s', (output, durationMs) => {
  const reader = createTranscriptActivityReader('codex')
  reader.observe(
    JSON.stringify({
      type: 'response_item',
      payload: {
        type: 'custom_tool_call',
        call_id: 'cancelled',
        name: 'exec',
        input: 'await wait()'
      }
    }),
    'call'
  )
  reader.observe(
    JSON.stringify({
      type: 'response_item',
      payload: {
        type: 'custom_tool_call_output',
        call_id: 'cancelled',
        output
      }
    }),
    'result'
  )
  expect(reader.snapshot().events).toMatchObject([
    {
      callId: 'cancelled',
      state: 'interrupted',
      ...(durationMs === undefined ? {} : { durationMs })
    }
  ])
  expect(reader.snapshot().statistics?.faults).toEqual({})
})

it('rejects context reports older than a model change, compaction or clearing', () => {
  const reader = createTranscriptActivityReader('claude')
  const report = {
    paneKey: 'tab:pane',
    sessionId: 'session',
    model: 'claude-sonnet-4-6',
    observedAt: 1000,
    contextUsage: {
      usedTokens: 40000,
      windowTokens: 200000,
      percentage: 20,
      estimated: false,
      categories: []
    }
  }
  reader.observeContextReport(report)
  reader.observe(
    JSON.stringify({
      type: 'assistant',
      timestamp: '1970-01-01T00:00:02Z',
      message: { id: 'new-model', model: 'claude-opus-4-6' }
    }),
    'model-change'
  )
  reader.observeContextReport({ ...report, observedAt: 1500 })
  expect(reader.snapshot()).toMatchObject({ model: 'claude-opus-4-6', contextUsage: null })
  reader.observeContextReport({ ...report, model: 'claude-opus-4-6', observedAt: 2500 })
  expect(reader.snapshot().contextUsage?.percentage).toBe(20)
  reader.observe(
    JSON.stringify({
      type: 'system',
      subtype: 'compact_boundary',
      timestamp: '1970-01-01T00:00:03Z'
    }),
    'compact'
  )
  reader.observeContextReport({ ...report, model: 'claude-opus-4-6', observedAt: 2750 })
  expect(reader.snapshot().contextUsage).toBeNull()
  reader.observe(
    JSON.stringify({
      type: 'system',
      subtype: 'context_cleared',
      timestamp: '1970-01-01T00:00:04Z'
    }),
    'clear'
  )
  reader.observeContextReport({ ...report, model: 'claude-opus-4-6', observedAt: 3500 })
  expect(reader.snapshot().contextUsage).toBeNull()
})
