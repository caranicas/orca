import type { NativeChatMessage, NativeChatTurnLifecycle } from '../../native-chat-types'
import type { TerminalActivityTelemetry } from '../../../agent-session/activity/terminal-activity-telemetry'

/** One page of a transcript, newest last; `beforeOffset` is where the next older page ends. */
export type NativeChatTranscriptPage = {
  messages: NativeChatMessage[]
  hasMore: boolean
  beforeOffset: number
}

/** A `nativeChat.subscribe` stream frame. */
export type NativeChatTranscriptFrame =
  | (Omit<NativeChatTranscriptPage, 'beforeOffset'> &
      Partial<Pick<NativeChatTranscriptPage, 'beforeOffset'>> & {
        type: 'snapshot'
        // No transcript exists yet; the window is empty but not settled history.
        pending?: true
        // The page starts at the row named by the subscribe's resumeAfter.
        resumed?: true
        error?: string
        activityMap?: TerminalActivityTelemetry
        lifecycle?: NativeChatTurnLifecycle
      })
  | (NativeChatTranscriptPage & {
      type: 'replacement'
      activityMap?: TerminalActivityTelemetry
      lifecycle?: NativeChatTurnLifecycle
    })
  | {
      type: 'appended'
      messages: NativeChatMessage[]
      activityMap?: TerminalActivityTelemetry
      lifecycle?: NativeChatTurnLifecycle
    }
  | { type: 'end' }
