import { observeActivityMapOptions } from '../../shared/agent-session/activity/activity-map-observer-options'
import {
  readTranscriptActivityObservations,
  subscribeTranscriptActivityReports
} from './transcript-activity-observations'
import { reconcileActivityMapModelRequests } from '../../shared/agent-session/activity/activity-map-model-request'
import { mergeTerminalActivity } from '../../shared/agent-session/activity/merge-terminal-activity'
import {
  readIncrementalTranscriptMessages,
  type IncrementalTranscriptState
} from './transcript-watching/transcript-incremental-reader'
import type { NativeChatTurnLifecycle } from '../../shared/native-chat/native-chat-types'
import {
  readNativeChatTranscriptTailFile,
  type NativeChatLineDecoder
} from './transcript-tail-reader'
import { nativeChatTurnLifecycleDecoderForAgent } from './transcript-decoding/transcript-turn-lifecycle'
import { createTranscriptActivityReader } from './transcript-activity-reader'
import { createTranscriptHookActivity } from './transcript-hook-activity'
import {
  subscribeClaudeStatuslineContext,
  type ClaudeStatuslineContext
} from '../claude/statusline-context'
import type { SubscribeNativeChatTranscriptArgs } from './transcript-watching/transcript-watch-contract'

export function createTranscriptActivityMonitor(
  args: SubscribeNativeChatTranscriptArgs,
  onChange: () => void
) {
  const stopOptions = observeActivityMapOptions(args.paneKey, args.activityMapOptions)
  let reader = createTranscriptActivityReader(args.agent, undefined, args.activityMapOptions)
  let contextReport: ClaudeStatuslineContext | undefined
  const stopContext =
    args.agent === 'claude'
      ? subscribeClaudeStatuslineContext(args.paneKey, args.sessionId, (report) => {
          contextReport = report
          reader.observeContextReport(report)
          onChange()
        })
      : () => {}
  const hooks = createTranscriptHookActivity({
    paneKey: args.paneKey,
    sessionId: args.sessionId,
    checkpoint: readTranscriptActivityObservations(args.paneKey, args.sessionId),
    subscribe: (listener) => {
      const stopHooks = args.subscribeActivity?.(listener)
      const stopReports = subscribeTranscriptActivityReports(listener)
      return () => {
        stopHooks?.()
        stopReports()
      }
    },
    onChange
  })
  return {
    reader: () => reader,
    observe: (line: string, id: string) => reader.observe(line, id),
    snapshot() {
      reader.snapshot()
      if (contextReport) {
        reader.observeContextReport(contextReport)
      }
      const report = hooks.events().findLast((event) => event.context)
      if (report?.context) {
        reader.observeContextReport({
          paneKey: args.paneKey ?? '',
          sessionId: args.sessionId,
          model: report.context.model,
          contextUsage: report.context.usage,
          observedAt: report.endedAt ?? report.startedAt
        })
      }
      const snapshot = reader.snapshot()
      const requests = reconcileActivityMapModelRequests(
        snapshot.events,
        hooks.facts(),
        reader.modelRequests()
      )
      const recent = new Set(hooks.events().map((event) => event.id))
      return {
        ...snapshot,
        statistics: reader.snapshot([...requests.revisions, ...requests.additional]).statistics,
        events: mergeTerminalActivity(
          requests.durable,
          requests.additional.filter((event) => recent.has(event.id)),
          []
        )
      }
    },
    reset() {
      reader = createTranscriptActivityReader(args.agent, undefined, args.activityMapOptions)
      contextReport = undefined
      hooks.reset()
    },
    dispose() {
      stopOptions()
      stopContext()
      hooks.dispose()
    }
  }
}

export async function readTranscriptActivitySnapshot(input: {
  filePath: string
  limit: number
  decode: NativeChatLineDecoder
  args: SubscribeNativeChatTranscriptArgs
  signal: AbortSignal
  onBoundary: (boundary: Buffer) => void
  activity?: ReturnType<typeof createTranscriptActivityMonitor>
}) {
  const { filePath, limit, decode, args, signal, onBoundary, activity } = input
  const result = await readNativeChatTranscriptTailFile(
    filePath,
    limit,
    decode,
    false,
    undefined,
    nativeChatTurnLifecycleDecoderForAgent(args.agent),
    signal,
    onBoundary,
    args.sourceOrder,
    undefined,
    args.activityMap
      ? (activity?.reader() ??
          createTranscriptActivityReader(args.agent, undefined, args.activityMapOptions))
      : undefined
  )
  return result
}

export async function emitTranscriptActivityAppends(input: {
  filePath: string
  state: IncrementalTranscriptState
  decode: NativeChatLineDecoder
  args: SubscribeNativeChatTranscriptArgs
  signal: AbortSignal
  isClosed: () => boolean
  activity?: ReturnType<typeof createTranscriptActivityMonitor>
}) {
  const { filePath, state, decode, args, signal, isClosed, activity } = input
  let lifecycle: NativeChatTurnLifecycle | undefined
  const remaining = await readIncrementalTranscriptMessages(
    filePath,
    state,
    decode,
    (messages) => {
      if (!isClosed()) {
        args.onAppend(messages, undefined, activity?.snapshot())
      }
    },
    nativeChatTurnLifecycleDecoderForAgent(args.agent) ?? undefined,
    (next) => {
      lifecycle = next
    },
    signal,
    args.sourceOrder
  )
  if (!isClosed() && (remaining.length > 0 || lifecycle || activity)) {
    args.onAppend(remaining, lifecycle, activity?.snapshot())
  }
}
