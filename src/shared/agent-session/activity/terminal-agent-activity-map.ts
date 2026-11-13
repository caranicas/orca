import { agentJournalToolCallLifecycle } from '../../agent-journal-tool-call-lifecycle'
import type {
  NativeChatBlock,
  NativeChatMessage,
  NativeChatToolCallBlock,
  NativeChatToolResultBlock
} from '../../native-chat/native-chat-types'
import { pairNativeChatToolResults } from '../../native-chat/tools/native-chat-tool-pairing'
import { activityMapToolDetails, type ActivityMapEvent } from './agent-activity-map'

function isUserMessage(message: NativeChatMessage): boolean {
  return (
    message.role === 'user' &&
    message.blocks.some((block) => block.type === 'text' || block.type === 'image-ref')
  )
}

function terminalToolResults(messages: readonly NativeChatMessage[]) {
  const results = new Map<NativeChatToolCallBlock, NativeChatToolResultBlock>()
  const turns = new Map<string | undefined, NativeChatBlock[]>()
  const flush = (blocks: NativeChatBlock[]) => {
    for (const [call, result] of pairNativeChatToolResults(blocks).resultByCall) {
      results.set(call, result)
    }
  }
  for (const message of messages) {
    let blocks = turns.get(message.agentId)
    if (isUserMessage(message) && blocks) {
      flush(blocks)
      blocks = undefined
    }
    if (!blocks) {
      blocks = []
      turns.set(message.agentId, blocks)
    }
    blocks.push(...message.blocks)
  }
  for (const blocks of turns.values()) {
    flush(blocks)
  }
  return results
}

/** Use transcript evidence only; an absent result never proves a call is still running. */
export function projectTerminalAgentActivityMap(
  messages: readonly NativeChatMessage[]
): ActivityMapEvent[] {
  const events: ActivityMapEvent[] = []
  const resultByCall = terminalToolResults(messages)
  for (const message of messages) {
    const base = {
      id: message.id,
      origin:
        message.agentId !== undefined && message.producerKind !== 'background' ? 'agents' : 'core',
      startedAt: message.timestamp ?? 0
    } as const
    if (isUserMessage(message) || message.role === 'reasoning') {
      events.push({
        ...base,
        station: message.role === 'reasoning' ? 'model' : message.from ? 'agents' : 'you',
        label: message.role === 'reasoning' ? 'Reasoning' : 'Message',
        state: message.state ?? 'observed'
      })
    }
    for (const [index, block] of message.blocks.entries()) {
      if (block.type !== 'tool-call') {
        continue
      }
      const result = resultByCall.get(block)
      const lifecycle = agentJournalToolCallLifecycle(block)
      events.push({
        ...base,
        id: `${message.id}:tool:${index}`,
        ...activityMapToolDetails(block),
        state: result
          ? result.isError
            ? 'failed'
            : 'completed'
          : block.endedAs === 'unverifiable'
            ? 'unknown'
            : (lifecycle ?? 'unknown'),
        ...(block.durationMs !== undefined ? { durationMs: block.durationMs } : {})
      })
    }
  }
  return events
}
