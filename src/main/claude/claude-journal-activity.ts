import type { ActivityMapEvent } from '../../shared/agent-session/activity/agent-activity-map'
import type { StructuredAgentSessionEventSink } from '../native-chat/agent-session-wire/journal-ingress/structured-agent-session-event-sink'
import type { ClaudeProvisionalRowCorrections } from './subagents/claude-provisional-row-corrections'
import { createClaudeModelActivity } from './claude-model-activity'
import { createProviderHookActivity } from '../native-chat/provider-hook-activity'
import { journalProviderActivity } from '../native-chat/journal-provider-activity'

export function createClaudeJournalActivity(
  sink: StructuredAgentSessionEventSink,
  corrections: ClaudeProvisionalRowCorrections
) {
  const model = createClaudeModelActivity()
  const hooks = createProviderHookActivity()
  const append = (fact: ActivityMapEvent): void => {
    const identity = { provider: 'orca' as const, clientMessageId: fact.id }
    const body = journalProviderActivity('claude', fact)
    sink.appendItem(identity, body, {
      ...corrections.stampFor(fact.agentId ?? null)(identity, body),
      lifecycle: true
    })
    sink.publish()
  }
  return {
    observe(frame: Record<string, unknown>, at: number) {
      const response = model.observe(frame, at)
      if (response) {
        append(response)
      }
      const hook = hooks('claude', String(frame.subtype), frame, at)
      if (hook) {
        append(hook)
      }
    },
    settle(at: number, rootOnly = false) {
      model.settle(at, rootOnly).forEach(append)
    }
  }
}
