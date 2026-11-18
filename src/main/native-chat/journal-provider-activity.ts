import type { ActivityMapEvent } from '../../shared/agent-session/activity/agent-activity-map'
import type { AgentJournalPlainStatusItem } from '../../shared/agent-session/journal/agent-session-journal-types'
import {
  boundPayload,
  PROVIDER_FRAME_PAYLOAD_LIMITS
} from './agent-session-journal/item-lifecycle/journal-payload-bounds'

export function journalProviderActivity(
  provider: string,
  event: ActivityMapEvent
): AgentJournalPlainStatusItem {
  const kind = 'activity-map:observation'
  return {
    kind: 'status',
    text: `${provider} · ${kind}`,
    providerFrame: {
      provider,
      kind,
      payload: boundPayload(JSON.stringify(event), PROVIDER_FRAME_PAYLOAD_LIMITS)
    }
  }
}
