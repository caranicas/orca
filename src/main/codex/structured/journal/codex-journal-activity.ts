import { createProviderHookActivity } from '../../../native-chat/provider-hook-activity'
import { journalProviderActivity } from '../../../native-chat/journal-provider-activity'
import {
  CODEX_JOURNAL_ADMITTED,
  type CodexJournalTranslatorDeps
} from './codex-structured-journal-contracts'
import type { CodexStructuredSessionEvent } from '../session-lifecycle/codex-structured-session-state'
import type { CodexRowAttribution } from '../background-work/codex-subagent-linkage'
import { readCodexTurnId } from '../../app-server/codex-structured-thread-facts'
import { readRecord } from '../../app-server/codex-item-field-readers'
import type { ActivityMapEvent } from '../../../../shared/agent-session/activity/agent-activity-map'

export function createCodexJournalActivity(
  deps: CodexJournalTranslatorDeps,
  attributionFor: CodexRowAttribution
) {
  const observe = createProviderHookActivity()
  return (event: Extract<CodexStructuredSessionEvent, { type: 'notification' }>) => {
    let fact: ActivityMapEvent | null = observe(
      'codex',
      event.method,
      event.params,
      event.observedAt ?? deps.now?.() ?? Date.now()
    )
    const responseId = readRecord(event.params).responseId
    if (event.method === 'rawResponse/completed' && typeof responseId === 'string' && responseId) {
      fact = {
        id: `model:${responseId}`,
        station: 'model',
        origin: 'core',
        state: 'completed',
        mark: 'step',
        label: 'Model response',
        startedAt: event.observedAt ?? deps.now?.() ?? Date.now()
      }
    }
    if (!fact) {
      return CODEX_JOURNAL_ADMITTED
    }
    const identity = { provider: 'orca' as const, clientMessageId: fact.id }
    const options = {
      ...attributionFor(event.threadId, readCodexTurnId(event.params)),
      lifecycle: true
    }
    const body = journalProviderActivity('codex', fact)
    const admission = deps.sink.tryAppendItem
      ? deps.sink.tryAppendItem(identity, body, options)
      : (deps.sink.appendItem(identity, body, options), CODEX_JOURNAL_ADMITTED)
    if (admission.accepted) {
      deps.sink.publish()
    }
    return admission
  }
}
