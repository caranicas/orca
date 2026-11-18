import type { ActivityMapClassificationOptions } from '../../shared/agent-session/activity/activity-map-classification-options'
import { decodeClaudeTranscriptLine, decodeCodexTranscriptLine } from './transcript-line-decoders'
import { projectTerminalAgentActivityMap } from '../../shared/agent-session/activity/terminal-agent-activity-map'
import type { ActivityMapEvent } from '../../shared/agent-session/activity/agent-activity-map'
import { readClaudeTaskNotification } from '../../shared/claude-task-notification-text'
import { asRecord, parseJsonObject } from '../ai-vault/session-scanner-values'
import { activityMapTask } from '../../shared/agent-session/activity/activity-map-task'

export function transcriptActivityMessage(
  provider: string | null,
  line: string,
  id: string,
  options?: ActivityMapClassificationOptions
) {
  const message =
    provider === 'codex'
      ? decodeCodexTranscriptLine(line, id)
      : provider === 'claude'
        ? decodeClaudeTranscriptLine(line, id)
        : null
  if (!message) {
    return { events: [], results: [], notices: [] }
  }
  const events = projectTerminalAgentActivityMap([message], options)
  const origin: ActivityMapEvent['origin'] = message.agentId ? 'agents' : 'core'
  const response = asRecord(parseJsonObject(line)?.toolUseResult)
  const taskId = activityMapTask(response)
  const notices =
    message.role === 'user'
      ? message.blocks.flatMap((block) => {
          const notice =
            block.type === 'text' ? readClaudeTaskNotification(block.text.trimStart()) : null
          return notice ? [{ ...notice, endedAt: message.timestamp ?? 0 }] : []
        })
      : []
  const results = message.blocks.flatMap((block) =>
    block.type === 'tool-result' && block.callId
      ? [
          {
            callId: block.callId,
            ...(block.durationMs !== undefined ? { durationMs: block.durationMs } : {}),
            origin,
            agentId: message.agentId,
            state: block.isInterrupted
              ? ('interrupted' as const)
              : block.isError
                ? ('failed' as const)
                : taskId
                  ? ('running' as const)
                  : ('completed' as const),
            ...(taskId ? { taskId } : {}),
            endedAt: message.timestamp ?? 0
          }
        ]
      : []
  )
  return { events, results, notices }
}
