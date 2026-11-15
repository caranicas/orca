import type { AgentJournalRenderItem } from '../journal/agent-session-journal-types'
import { projectAgentActivityMap, type ActivityMapEvent } from './agent-activity-map'
import {
  activityMapProviderClassification,
  type ActivityMapProviderOptions
} from './activity-map-provider-options'
import { createActivityMapStatistics, type ActivityMapStatistics } from './activity-map-statistics'
import { mergeTerminalActivity } from './merge-terminal-activity'

export type ActivityMapJournalSummary = {
  events: ActivityMapEvent[]
  statistics: ActivityMapStatistics
}

export function activityMapJournalSummary(
  items: readonly AgentJournalRenderItem[],
  options: ActivityMapProviderOptions
): ActivityMapJournalSummary {
  const events = mergeTerminalActivity(
    projectAgentActivityMap(items, activityMapProviderClassification(options)),
    [],
    []
  )
  const statistics = createActivityMapStatistics()
  for (const event of events) {
    statistics.observe(event)
  }
  const recent = new Set(events.slice(-80).map((event) => event.id))
  return {
    events: events.filter(
      (event) => recent.has(event.id) || event.state === 'running' || event.state === 'waiting'
    ),
    statistics: statistics.snapshot()
  }
}
