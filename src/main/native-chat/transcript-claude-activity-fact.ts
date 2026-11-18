import { asRecord } from '../ai-vault/parsing/session-record-fields'
import { extractString } from '../../shared/text/trimmed-string'
import { contextTokensFromUsage } from '../../shared/agent-session/conversation-context/agent-session-context-usage'
import { claudeTokenUsage, claudeContextWindowHint } from '../claude/context-usage/claude-context-usage'
import type { ActivityMapEvent } from '../../shared/agent-session/activity/agent-activity-map'
import {
  activityMeasurement as count,
  type TranscriptActivityFact
} from './transcript-activity-fact'

export function claudeTranscriptActivityFact(
  record: Record<string, unknown>,
  event: ActivityMapEvent
): TranscriptActivityFact {
  const fact: TranscriptActivityFact = {}
  const message = asRecord(record.message)
  if (record.type === 'assistant' && record.isSidechain !== true) {
    fact.model = extractString(message?.model) ?? undefined
    const usage = claudeTokenUsage(message?.usage)
    const window =
      count(asRecord(record.context_window)?.context_window_size) ??
      (fact.model ? claudeContextWindowHint(fact.model) : null)
    if (window) {
      fact.claudeWindow = window
    }
    if (usage) {
      fact.claudeInput = contextTokensFromUsage(usage)
      fact.event = {
        ...event,
        id: `model:${extractString(message?.id) ?? event.id}`,
        label: 'Model response',
        state: typeof message?.stop_reason === 'string' ? 'completed' : 'observed',
        mark: 'step',
        ...(typeof record.uuid === 'string' ? { transcriptIds: [record.uuid] } : {})
      }
    }
  }
  if (record.type === 'result') {
    fact.modelUsage = asRecord(record.modelUsage) ?? undefined
  }
  if (
    record.type === 'conversation_reset' ||
    (record.type === 'system' &&
      (record.subtype === 'compact_boundary' || record.subtype === 'context_cleared'))
  ) {
    fact.context = null
    fact.event = {
      ...event,
      label: record.subtype === 'context_cleared' ? 'Context cleared' : 'Context compacted',
      state: record.subtype === 'compact_boundary' ? 'completed' : 'observed',
      mark: record.subtype === 'compact_boundary' ? 'compact' : 'metadata'
    }
  }

  return fact
}
