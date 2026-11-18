import type { ActivityMapProviderOptions } from '../../shared/agent-session/activity/activity-map-provider-options'
import type { SubscribeTranscriptHookActivity } from './transcript-hook-activity'
export const DESKTOP_READ_WINDOW = 300
export const UNFLUSHED_SETTLE_MS = 1_500
import type { TerminalActivityTelemetry } from '../../shared/agent-session/activity/terminal-activity-telemetry'

import type { AgentType } from '../../../shared/agent-status/contracts/agent-status-types'
import type {
  NativeChatMessage,
  NativeChatTurnLifecycle
} from '../../../shared/native-chat/native-chat-types'
import type { ResolveSessionFileOptions } from '../session-file-resolver'

export type SubscribeNativeChatTranscriptArgs = ResolveSessionFileOptions & {
  paneKey?: string
  subscribeActivity?: SubscribeTranscriptHookActivity
  activityMapOptions?: ActivityMapProviderOptions
  activityMap?: boolean
  agent: AgentType
  sessionId: string
  onAppend: (
    messages: NativeChatMessage[],
    lifecycle?: NativeChatTurnLifecycle,
    activityMap?: TerminalActivityTelemetry
  ) => void
  onInitialSnapshot?: (
    messages: NativeChatMessage[],
    hasMore: boolean,
    beforeOffset: number,
    error?: string,
    lifecycle?: NativeChatTurnLifecycle,
    activityMap?: TerminalActivityTelemetry
  ) => void
  /** Report unflushed history once before snapshots so views can leave loading without claiming a settled read. */
  onTranscriptPending?: () => void
  onReplace?: (
    messages: NativeChatMessage[],
    hasMore: boolean,
    beforeOffset: number,
    lifecycle?: NativeChatTurnLifecycle,
    activityMap?: TerminalActivityTelemetry
  ) => void
  initialLimit?: number
  sourceOrder?: boolean
  filePath?: string
  debounceMs?: number
  resolvePollIntervalMs?: number
  reconciliationIntervalMs?: number
}

export type NativeChatTranscriptSubscription = {
  unsubscribe: () => void
  watching: boolean
}

export type NativeChatTailArgs = ResolveSessionFileOptions & {
  agent: AgentType
  sessionId: string
  transcriptPath?: string
  filePath?: string
  limit: number
  beforeOffset?: number
  sourceOrder?: boolean
  activityMapOptions?: ActivityMapProviderOptions
  activityMap?: boolean
}
export type NativeChatTailResult =
  | {
      messages: NativeChatMessage[]
      lifecycle?: NativeChatTurnLifecycle
      activityMap?: TerminalActivityTelemetry
      hasMore: boolean
      beforeOffset: number
    }
  | { error: string; notFound?: true }
