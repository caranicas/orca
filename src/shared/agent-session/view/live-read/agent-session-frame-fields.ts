import type { AgentJournalTurnLifecycle } from '../../journal/agent-session-journal-types'
import type { AgentSessionCurrentRequestsMarker } from '../../requests/agent-session-current-requests-wire'
import type { AgentSessionQueuePublicationFields } from '../../requests/agent-session-queued-message-wire'

/** Published-frame host wall clock (epoch ms per AgentSessionHistoryPage) and queuedMessages companions. */
export type AgentSessionFrameFields = {
  commandsChanged?: true
  hostNow?: number
  /** Version of the independent current-request read; absent from older hosts. */
  currentRequests?: AgentSessionCurrentRequestsMarker
} & AgentSessionQueuePublicationFields

/** The agent's guess at the user's next prompt; never journaled, replaced when a turn opens. */
export type AgentSessionPromptSuggestion = {
  id: string
  text: string
}

/** Newest turn across the whole journal, including off-page long-running turns. null means no turn; older hosts omit it and clients derive from loaded rows. */
export type AgentSessionLatestTurn = {
  /** The record's journal key, which rows of the turn name as their scope. */
  itemId: string
  /** Host clock at the record's creation, as on its own row; a revision does not move it. */
  observedAt: number
  turn: AgentJournalTurnLifecycle
}
