import { asRecord } from '../../ai-vault/parsing/session-record-fields'
import { extractString } from '../../../shared/text/trimmed-string'
import { parsePaneKey } from '../../../shared/workspace-layout/stable-pane-id'
import { activityMapHookEvent } from '../../../shared/agent-session/activity/activity-map-hook-event'
import { activityMapObserverOptions } from '../../../shared/agent-session/activity/activity-map-observer-options'
import { publishTranscriptActivityObservation } from '../../native-chat/transcript-activity-observations'

export function receiveClaudeActivityReport(body: unknown): boolean | undefined {
  const record = asRecord(body)
  if (record?.action !== 'activity') {
    return undefined
  }
  const paneKey = extractString(record.paneKey)
  const payload = asRecord(record.payload)
  const sessionId = extractString(payload?.session_id)
  if (
    !paneKey ||
    paneKey.length > 256 ||
    !parsePaneKey(paneKey) ||
    !payload ||
    !sessionId ||
    sessionId.length > 256
  ) {
    return false
  }
  const event = activityMapHookEvent('OrcaActivity', payload, activityMapObserverOptions(paneKey))
  if (!event) {
    return false
  }
  publishTranscriptActivityObservation({
    paneKey,
    source: 'claude',
    connectionId: null,
    providerSession: { key: 'session_id', id: sessionId },
    receivedAt: Date.now(),
    hookEventName: 'OrcaActivity',
    activityMapEvent: event,
    // This carrier never enters the status reducer; the observer consumes only its scoped fact.
    payload: { agentType: 'claude', state: 'done', prompt: '' }
  })
  return true
}
