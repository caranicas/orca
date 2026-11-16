import { activityMapText } from '../../shared/agent-session/activity/activity-map-text'
import type { ActivityMapEvent } from '../../shared/agent-session/activity/agent-activity-map'
import { extractString } from '../ai-vault/session-scanner-values'
import { activityMeasurement } from './transcript-activity-fact'

export function codexTranscriptTurnActivity(
  payload: Record<string, unknown>,
  event: ActivityMapEvent,
  language = 'en'
): ActivityMapEvent | undefined {
  const turnId = extractString(payload.turn_id)
  if (payload.type === 'task_started' && turnId) {
    return {
      ...event,
      id: `turn:${turnId}`,
      station: 'you',
      label: activityMapText(language).running,
      state: 'running',
      mark: 'step',
      inbound: true
    }
  }
  if (
    payload.type !== 'task_complete' &&
    payload.type !== 'turn_complete' &&
    payload.type !== 'turn_aborted'
  ) {
    return undefined
  }
  const duration = activityMeasurement(payload.duration_ms)
  const failed = payload.error != null
  const interrupted = payload.type === 'turn_aborted'
  const answer = payload.last_agent_message !== null
  return {
    ...event,
    id: `turn:${turnId ?? event.id}`,
    station: 'you',
    label: failed
      ? 'Turn failed'
      : interrupted
        ? 'Interrupted'
        : answer
          ? 'Answer ready'
          : 'Turn ended',
    state: failed ? 'failed' : interrupted ? 'interrupted' : 'completed',
    mark: failed ? undefined : interrupted ? 'interrupted' : answer ? 'done' : undefined,
    inbound: false,
    ...(duration !== null ? { durationMs: duration } : {})
  }
}
