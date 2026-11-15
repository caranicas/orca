import type { ActivityMapEvent } from '../../shared/agent-session/activity/agent-activity-map'
import type { TerminalActivityTelemetry } from '../../shared/agent-session/activity/terminal-activity-telemetry'
import type { transcriptActivityMessage } from './transcript-activity-message'

export type TranscriptActivityFact = {
  cwd?: string
  model?: string
  context?: TerminalActivityTelemetry['contextUsage']
  event?: ActivityMapEvent
  at?: number
  claudeInput?: number
  claudeWindow?: number
  modelUsage?: Record<string, unknown>
  decoded?: ReturnType<typeof transcriptActivityMessage>
}

export function activityMeasurement(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}
