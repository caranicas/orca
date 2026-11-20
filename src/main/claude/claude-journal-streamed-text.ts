import type { ClaudeJournalTranslatorDeps } from './structured/journal/claude-journal-translator-contract'
import type { AgentJournalTurnScope } from '../../shared/agent-session/journal/agent-session-journal-turn-scope'
import { createClaudeStreamedTextCheckpoints } from './structured/journal/claude-streamed-text-checkpoints'
import { claudeStreamingMessageBody } from './structured/journal/claude-structured-item-translation'

export function createClaudeJournalStreamedText(
  deps: ClaudeJournalTranslatorDeps,
  producer: Parameters<typeof createClaudeStreamedTextCheckpoints>[0]['producer'],
  turnScope: () => AgentJournalTurnScope
) {
  return createClaudeStreamedTextCheckpoints({
    ...(deps.coalesceMs === undefined ? {} : { coalesceMs: deps.coalesceMs }),
    ...(deps.schedule ? { schedule: deps.schedule } : {}),
    producer,
    persist: (identity, text, options, ended) => {
      deps.sink.appendItem(identity, claudeStreamingMessageBody(text), {
        ...options,
        turnScope: turnScope(),
        ...(ended ? { lifecycle: true } : {})
      })
      deps.sink.publish()
    }
  })
}
