import { expect, it } from 'vitest'
import { activityMapJournalTelemetry } from './activity-map-journal-telemetry'
import type { ActivityMapEvent } from './agent-activity-map'
import { activityMapJournalSummary } from './activity-map-journal-summary'
import { DEFAULT_ACTIVITY_MAP_PROVIDER_OPTIONS } from './activity-map-provider-options'

it('drops pre-clear activity from a full journal summary', () => {
  const result = activityMapJournalSummary(
    [
      {
        itemId: 'before',
        revision: 1,
        sequence: 1,
        observedAt: 1000,
        body: { kind: 'message', role: 'user', blocks: [{ type: 'text', text: 'Before' }] }
      },
      {
        itemId: 'clear',
        revision: 1,
        sequence: 2,
        observedAt: 2000,
        body: {
          kind: 'status',
          text: 'Cleared',
          contextClear: { operationId: 'clear-1', afterFence: 7, clearedAt: 2000 }
        }
      },
      {
        itemId: 'after',
        revision: 1,
        sequence: 3,
        observedAt: 3000,
        body: { kind: 'message', role: 'user', blocks: [{ type: 'text', text: 'After' }] }
      }
    ],
    DEFAULT_ACTIVITY_MAP_PROVIDER_OPTIONS
  )
  expect(result.events.map((event) => event.id)).toEqual(['after'])
})

it('joins identical provider responses while preserving child work and full-history totals', () => {
  const response: ActivityMapEvent = {
    id: 'model:response-1',
    station: 'model',
    origin: 'core',
    state: 'completed',
    label: 'Model response',
    mark: 'step',
    startedAt: 1000
  }
  const result = activityMapJournalTelemetry(
    {
      events: [
        response,
        { ...response, id: 'child-response', origin: 'agents', agentId: 'child-1' },
        { ...response, id: 'compaction', mark: 'compact' }
      ],
      statistics: { counts: { model: 3, you: 2 }, faults: {}, clearedAt: 0 },
      coreModelCount: 2
    },
    {
      model: 'gpt-6.1-sol',
      contextUsage: null,
      hostNow: 2000,
      events: [
        response,
        { ...response, id: 'model:response-2', startedAt: 1500 },
        { ...response, id: 'child-response', origin: 'agents', agentId: 'child-1' }
      ],
      statistics: { counts: { model: 6 }, faults: {}, clearedAt: 0 },
      coreModelCount: 5
    }
  )
  expect(result.events.map((event) => event.id)).toEqual([
    'model:response-1',
    'child-response',
    'compaction',
    'model:response-2'
  ])
  expect(result.statistics.counts).toEqual({ model: 6, you: 2 })
})
