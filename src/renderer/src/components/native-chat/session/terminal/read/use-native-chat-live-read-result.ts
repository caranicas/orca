import { useMemo } from 'react'
import {
  mergeNativeChatLiveSession,
  type NativeChatLiveMergeInput
} from '../../../../../../../shared/native-chat/transcript/streaming/native-chat-live-status'
import type { NativeChatLiveSession } from './native-chat-live-session-contract'

type Input = NativeChatLiveMergeInput &
  Pick<
    NativeChatLiveSession,
    | 'activityMap'
    | 'hasMore'
    | 'loadingEarlier'
    | 'olderHistoryGeneration'
    | 'loadEarlier'
    | 'trimHistory'
    | 'readPhase'
  >

export function useNativeChatLiveReadResult({
  messages,
  sessionId,
  agent,
  hookState,
  stateStartedAt,
  transcriptLifecycle,
  statusTailMessage,
  hookHasWorkingSubagents,
  loading,
  error,
  activityMap,
  hasMore,
  loadingEarlier,
  olderHistoryGeneration,
  loadEarlier,
  trimHistory,
  readPhase
}: Input): NativeChatLiveSession {
  return useMemo(
    () => ({
      ...mergeNativeChatLiveSession({
        messages,
        sessionId,
        agent,
        hookState,
        stateStartedAt,
        transcriptLifecycle,
        statusTailMessage,
        hookHasWorkingSubagents,
        loading,
        error
      }),
      activityMap,
      hasMore,
      loadingEarlier,
      olderHistoryGeneration,
      loadEarlier,
      trimHistory,
      readPhase
    }),
    [
      messages,
      sessionId,
      agent,
      hookState,
      stateStartedAt,
      transcriptLifecycle,
      statusTailMessage,
      hookHasWorkingSubagents,
      loading,
      error,
      activityMap,
      hasMore,
      loadingEarlier,
      olderHistoryGeneration,
      loadEarlier,
      trimHistory,
      readPhase
    ]
  )
}
