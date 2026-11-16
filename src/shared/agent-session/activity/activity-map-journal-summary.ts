import type { AgentJournalRenderItem } from '../journal/agent-session-journal-types'
import { projectAgentActivityMap, type ActivityMapEvent } from './agent-activity-map'
import {
  activityMapProviderClassification,
  type ActivityMapProviderOptions
} from './activity-map-provider-options'
import { createActivityMapStatistics, type ActivityMapStatistics } from './activity-map-statistics'
import { mergeTerminalActivity } from './merge-terminal-activity'
import { agentSessionCurrentContextRows } from '../agent-session-context-clear'

export type ActivityMapJournalSummary = {
  events: ActivityMapEvent[]
  statistics: ActivityMapStatistics
  coreModelCount?: number
}

export function activityMapJournalSummary(
  items: readonly AgentJournalRenderItem[],
  options: ActivityMapProviderOptions
): ActivityMapJournalSummary {
  const events = mergeTerminalActivity(
    projectAgentActivityMap(
      agentSessionCurrentContextRows(items).items,
      activityMapProviderClassification(options)
    ),
    [],
    []
  )
  const statistics = createActivityMapStatistics()
  const core = createActivityMapStatistics()
  for (const event of events) {
    statistics.observe(event)
    if (event.origin === 'core' && event.station === 'model') {
      core.observe(event)
    }
  }
  const recent = new Set(events.slice(-80).map((event) => event.id))
  return {
    events: events.filter(
      (event) => recent.has(event.id) || event.state === 'running' || event.state === 'waiting'
    ),
    statistics: statistics.snapshot(),
    coreModelCount: core.snapshot().counts.model ?? 0
  }
}
