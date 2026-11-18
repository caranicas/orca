import type { ActivityMapJournalSummary } from './activity-map-journal-summary'
import type { TerminalActivityTelemetry } from './terminal-activity-telemetry'
import { mergeTerminalActivity } from './merge-terminal-activity'
import { createActivityMapStatistics } from './activity-map-statistics'

export function activityMapJournalTelemetry(
  journal: ActivityMapJournalSummary,
  transcript?: TerminalActivityTelemetry
): ActivityMapJournalSummary {
  if (!transcript) {
    return journal
  }
  const responses = transcript.events.filter(
    (event) => event.station === 'model' && event.origin === 'core' && event.mark === 'step'
  )
  const statistics = createActivityMapStatistics(journal.statistics, journal.events)
  const combined = statistics.snapshot(responses)
  if (journal.coreModelCount !== undefined && transcript.coreModelCount !== undefined) {
    combined.counts.model =
      Math.max(0, (journal.statistics.counts.model ?? 0) - journal.coreModelCount) +
      Math.max(journal.coreModelCount, transcript.coreModelCount)
  }
  return {
    ...journal,
    events: mergeTerminalActivity(journal.events, responses, []),
    statistics: combined
  }
}
