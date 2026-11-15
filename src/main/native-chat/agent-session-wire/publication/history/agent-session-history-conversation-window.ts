import type { AgentJournalRenderItem } from '../../../../../shared/agent-session/journal/agent-session-journal-types'
import { isRootAgentJournalItem } from '../../../../../shared/agent-session/journal/agent-session-journal-producer'
import {
  isSubagentRow,
  newestWholeSequenceGroups,
  wholeSubagentGroupsStart
} from './agent-session-history-page-bounds'

/** Window by own-agent rows, retaining contiguous subagent work and whole sibling groups within byte bounds. */
export function conversationWindow(
  items: readonly AgentJournalRenderItem[],
  limit: number
): AgentJournalRenderItem[] {
  const own = items.filter((item) => isRootAgentJournalItem(item) && !isSubagentRow(item))
  if (own.length === items.length) {
    return newestWholeSequenceGroups(items, limit)
  }
  const ownWindow = newestWholeSequenceGroups(own, limit)
  const start = ownWindow.length < own.length ? ownWindow[0]?.sequence : undefined
  if (start === undefined) {
    return [...items]
  }
  const reach = newestWholeSequenceGroups(own, 2 * limit)
  const floor = reach.length < own.length ? reach[0]!.sequence : Number.NEGATIVE_INFINITY
  const whole = wholeSubagentGroupsStart(items, start, floor)
  return items.filter((item) => item.sequence >= whole)
}
