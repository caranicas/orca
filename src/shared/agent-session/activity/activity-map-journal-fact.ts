import type { AgentJournalRenderItem } from '../journal/agent-session-journal-types'
import { readTerminalActivityTelemetry } from './terminal-activity-telemetry'
import type { ActivityMapEvent } from './agent-activity-map'

export function activityMapJournalFact(item: AgentJournalRenderItem): ActivityMapEvent | null {
  if (item.body.kind !== 'status') {
    return null
  }
  if (item.body.presentation === 'compaction') {
    return {
      id: item.itemId,
      station: 'model',
      origin: item.agentId ? 'agents' : 'core',
      state: 'completed',
      label: 'Context compacted',
      mark: 'compact',
      startedAt: item.observedAt,
      ...(item.agentId ? { agentId: item.agentId } : {})
    }
  }
  const frame = item.body.providerFrame
  if (frame?.kind !== 'activity-map:observation' || frame.payload.truncated) {
    return null
  }
  try {
    const event = readTerminalActivityTelemetry({
      model: null,
      contextUsage: null,
      hostNow: item.observedAt,
      events: [JSON.parse(frame.payload.head)]
    })?.events[0]
    return event
      ? { ...event, ...(item.agentId ? { agentId: item.agentId, origin: 'agents' } : {}) }
      : null
  } catch {
    return null
  }
}
