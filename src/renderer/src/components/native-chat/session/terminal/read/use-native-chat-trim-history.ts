import { useCallback, type Dispatch, type SetStateAction, type MutableRefObject } from 'react'
import {
  boundNativeChatWindow,
  replaceList,
  type createNativeChatMerger
} from '../../../../../../../shared/native-chat/transcript/streaming/native-chat-merge'
import type { NativeChatMessage } from '../../../../../../../shared/native-chat/native-chat-types'
import { NATIVE_CHAT_INITIAL_LIMIT } from '../../../viewport/history/native-chat-pagination'
import type { ReadState } from './native-chat-live-session-contract'
import type { NativeChatSessionTransport } from './native-chat-session-transport'

type Input = {
  sessionId: string | null
  transport: NativeChatSessionTransport
  read: ReadState
  latestEnabled: MutableRefObject<boolean>
  latestSessionId: MutableRefObject<string | null>
  latestTransport: MutableRefObject<NativeChatSessionTransport>
  limitRef: MutableRefObject<number>
  transcriptEpochRef: MutableRefObject<number>
  appendMergerRef: MutableRefObject<ReturnType<typeof createNativeChatMerger>>
  setOlderHistoryGeneration: Dispatch<SetStateAction<number>>
  setLoadingEarlier: Dispatch<SetStateAction<boolean>>
  setRead: Dispatch<SetStateAction<ReadState>>
  setAppended: Dispatch<SetStateAction<NativeChatMessage[]>>
  setHasMore: Dispatch<SetStateAction<boolean>>
}

export function useNativeChatTrimHistory({
  sessionId,
  transport,
  read,
  latestEnabled: latestEnabledRef,
  latestSessionId: latestSessionIdRef,
  latestTransport: latestTransportRef,
  limitRef,
  transcriptEpochRef,
  appendMergerRef,
  setOlderHistoryGeneration,
  setLoadingEarlier,
  setRead,
  setAppended,
  setHasMore
}: Input) {
  const hasOlderBase = read.phase === 'ready' && read.messages.length > NATIVE_CHAT_INITIAL_LIMIT
  return useCallback(() => {
    if (
      !latestEnabledRef.current ||
      latestSessionIdRef.current !== sessionId ||
      latestTransportRef.current !== transport
    ) {
      return
    }
    limitRef.current = NATIVE_CHAT_INITIAL_LIMIT
    // Retire pagination without closing the independently owned live stream.
    transcriptEpochRef.current += 1
    setOlderHistoryGeneration(transcriptEpochRef.current)
    setLoadingEarlier(false)
    const merger = appendMergerRef.current
    const bounded = boundNativeChatWindow(merger.list, NATIVE_CHAT_INITIAL_LIMIT)
    const trimmedAppend = bounded !== merger.list
    setRead((current) => {
      if (current.phase !== 'ready') {
        return current
      }
      // Evict the base too when the append prefix is gone, keeping one contiguous suffix.
      const messages = trimmedAppend
        ? []
        : boundNativeChatWindow(current.messages, NATIVE_CHAT_INITIAL_LIMIT)
      return messages === current.messages ? current : { ...current, messages }
    })
    if (trimmedAppend) {
      replaceList(merger, bounded)
      setAppended(merger.list)
    }
    if (hasOlderBase || trimmedAppend) {
      setHasMore(true)
    }
  }, [
    hasOlderBase,
    sessionId,
    transport,
    latestEnabledRef,
    latestSessionIdRef,
    latestTransportRef,
    limitRef,
    transcriptEpochRef,
    appendMergerRef,
    setOlderHistoryGeneration,
    setLoadingEarlier,
    setRead,
    setAppended,
    setHasMore
  ])
}
