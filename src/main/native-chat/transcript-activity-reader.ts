import {
  activityMapProviderClassification,
  type ActivityMapProviderOptions
} from '../../shared/agent-session/activity/activity-map-provider-options'
import { activityMapModelRequestKey } from '../../shared/agent-session/activity/activity-map-model-request'
import { createTranscriptActivityEvents } from './transcript-activity-events'
import { transcriptActivityMessage } from './transcript-activity-message'
import {
  asRecord,
  extractString,
  parseJsonObject,
  timestampMs
} from '../ai-vault/session-scanner-values'
import type { AgentType } from '../../shared/agent-status/contracts/agent-status-types'
import { resolveNativeChatTranscriptAgent } from '../../shared/native-chat/native-chat-agent-support'
import {
  codexContextPercentage,
  type TerminalActivityTelemetry
} from '../../shared/agent-session/activity/terminal-activity-telemetry'
import type { ActivityMapEvent } from '../../shared/agent-session/activity/agent-activity-map'
import { claudeContextWindowFromResult } from '../claude/claude-context-usage'
import { claudeTranscriptActivityFact } from './transcript-claude-activity-fact'
import type { ClaudeStatuslineContext } from '../claude/statusline-context'
import { codexCompletedActivityItem } from './transcript-codex-activity-items'
import { transcriptHookMemory } from './transcript-hook-memory'
import {
  activityMeasurement as count,
  type TranscriptActivityFact
} from './transcript-activity-fact'

export function createTranscriptActivityReader(
  agent: AgentType,
  seed?: TerminalActivityTelemetry,
  options?: ActivityMapProviderOptions
) {
  const classification = activityMapProviderClassification(options)
  const provider = resolveNativeChatTranscriptAgent(agent)
  let model = seed?.model ?? null
  let cwd = seed?.cwd
  let modelAt = seed?.modelAt ?? 0
  let contextUsage = seed?.contextUsage ?? null
  const activity = createTranscriptActivityEvents(seed)
  let contextAt = seed?.contextAt ?? 0
  let claudeWindow: number | null =
    provider === 'claude' ? (seed?.contextUsage?.windowTokens ?? null) : null
  let claudeInput: number | null =
    provider === 'claude' ? (seed?.contextUsage?.usedTokens ?? null) : null
  const pending: TranscriptActivityFact[] = []

  function apply(fact: TranscriptActivityFact): void {
    cwd = fact.cwd ?? cwd
    if (fact.model) {
      modelAt = Math.max(modelAt, fact.at ?? fact.event?.startedAt ?? 0)
    }
    if (fact.model && fact.model !== model) {
      if (model && fact.event) {
        activity.observe({
          event: {
            ...fact.event,
            id: `${fact.event.id}:model`,
            station: 'model',
            state: 'observed',
            label: `${model} → ${fact.model}`,
            mark: 'switch'
          }
        })
      }
      model = fact.model
      contextAt = Math.max(contextAt, modelAt)
      contextUsage = null
      claudeWindow = null
      claudeInput = null
    }
    if (fact.modelUsage && model) {
      const normalized = model.replace(/\[[^\]]*\]$/u, '').toLowerCase()
      const sameModel = Object.keys(fact.modelUsage).some(
        (key) => key.replace(/\[[^\]]*\]$/u, '').toLowerCase() === normalized
      )
      const capacity = sameModel
        ? claudeContextWindowFromResult(
            { modelUsage: fact.modelUsage },
            { initModel: model, responseModel: model }
          )
        : null
      if (capacity) {
        fact.claudeWindow = capacity
      }
    }
    if (fact.claudeWindow !== undefined) {
      claudeWindow = fact.claudeWindow
    }
    if (fact.claudeInput !== undefined) {
      claudeInput = fact.claudeInput
    }
    if (
      provider === 'claude' &&
      (fact.claudeWindow !== undefined || fact.claudeInput !== undefined)
    ) {
      fact.context =
        claudeInput !== null && claudeWindow
          ? {
              usedTokens: claudeInput,
              windowTokens: claudeWindow,
              percentage: Math.round((claudeInput / claudeWindow) * 100),
              estimated: true,
              categories: []
            }
          : null
    }
    if (fact.context !== undefined) {
      contextUsage = fact.context
      contextAt = fact.at ?? fact.event?.endedAt ?? fact.event?.startedAt ?? contextAt
      if (
        fact.context === null &&
        fact.claudeInput === undefined &&
        fact.claudeWindow === undefined
      ) {
        claudeInput = null
      }
    }
    activity.observe(fact)
  }

  function observe(line: string, id: string, reverse = false): void {
    if (provider !== 'codex' && provider !== 'claude') {
      return
    }
    const record = parseJsonObject(line)
    if (!record) {
      return
    }
    const payload = asRecord(record.payload) ?? record
    const at = timestampMs(record.timestamp)
    const event: ActivityMapEvent = {
      id,
      station: 'model',
      origin: 'core',
      state: 'observed',
      label: '',
      startedAt: Number.isFinite(at) ? at : 0,
      mark: 'metadata'
    }
    const fact: TranscriptActivityFact = {
      at: event.startedAt,
      cwd:
        extractString(record.cwd) ??
        (record.type === 'session_meta' ? extractString(payload.cwd) : null) ??
        undefined,
      decoded: transcriptActivityMessage(provider, line, id, classification)
    }
    if (provider === 'codex') {
      if (payload.type === 'item_completed') {
        fact.event = codexCompletedActivityItem(payload, event, classification) ?? undefined
        const memory = options?.hookRecords
          ? transcriptHookMemory(asRecord(payload.item), event, options.language)
          : undefined
        if (memory && fact.decoded) {
          fact.decoded.events.push(memory)
        }
      }
      if (record.type === 'turn_context') {
        fact.model = extractString(payload.model) ?? undefined
      } else if (payload.type === 'thread_settings_applied') {
        fact.model = extractString(asRecord(payload.thread_settings)?.model) ?? undefined
      } else if (payload.type === 'token_count') {
        const info = asRecord(payload.info)
        const last = asRecord(info?.last_token_usage)
        const used = count(last?.total_tokens)
        const window = count(info?.model_context_window)
        if (info && used !== null) {
          fact.context =
            used > 0 && window && window > 0
              ? {
                  usedTokens: used,
                  windowTokens: window,
                  percentage: codexContextPercentage(used, window),
                  estimated: true,
                  categories: []
                }
              : null
        }
      } else if (record.type === 'token_usage_record' && extractString(payload.response_id)) {
        fact.event = {
          ...event,
          id: `model:${extractString(payload.response_id) ?? id}`,
          requestKey: activityMapModelRequestKey(payload.turn_id, payload.usage),
          label: 'Model response',
          state: 'completed',
          mark: 'step'
        }
      }
      if (
        record.type === 'compacted' ||
        payload.type === 'context_compacted' ||
        asRecord(payload.item)?.type === 'ContextCompaction'
      ) {
        fact.context = null
        const started = count(payload.started_at_ms)
        const ended = count(payload.completed_at_ms)
        fact.event = {
          ...event,
          label: 'Context compacted',
          state: 'completed',
          mark: 'compact',
          ...(started && ended && ended >= started
            ? { startedAt: started, endedAt: ended, durationMs: ended - started }
            : {})
        }
      }
      if (
        payload.type === 'task_complete' ||
        payload.type === 'turn_complete' ||
        payload.type === 'turn_aborted'
      ) {
        const duration = count(payload.duration_ms)
        const failed = payload.error != null
        fact.event = {
          ...event,
          id: `turn:${extractString(payload.turn_id) ?? id}`,
          station: 'you',
          label: failed
            ? 'Turn failed'
            : payload.type === 'turn_aborted'
              ? 'Interrupted'
              : 'Answer ready',
          state: failed ? 'failed' : payload.type === 'turn_aborted' ? 'interrupted' : 'completed',
          mark: failed ? undefined : payload.type === 'turn_aborted' ? 'interrupted' : 'done',
          ...(duration !== null ? { durationMs: duration } : {})
        }
      }
    } else {
      Object.assign(fact, claudeTranscriptActivityFact(record, event))
    }
    if (fact.model) {
      fact.event ??= event
    }
    if (
      fact.decoded?.events.length ||
      fact.decoded?.results.length ||
      fact.decoded?.notices.length ||
      fact.modelUsage ||
      fact.cwd ||
      fact.model ||
      fact.context !== undefined ||
      fact.event ||
      fact.claudeWindow !== undefined ||
      fact.claudeInput !== undefined
    ) {
      if (reverse) {
        pending.push(fact)
      } else {
        apply(fact)
      }
    }
  }

  return {
    observe,
    modelRequests: activity.modelRequests,
    observeContextReport(report: ClaudeStatuslineContext) {
      if (report.observedAt >= Math.max(contextAt, modelAt)) {
        apply({
          model: report.model,
          context: report.contextUsage,
          at: report.observedAt,
          event: {
            id: `statusline:${report.observedAt}`,
            station: 'model',
            origin: 'core',
            state: 'observed',
            label: '',
            startedAt: report.observedAt,
            mark: 'metadata'
          }
        })
        claudeWindow = report.contextUsage?.windowTokens ?? claudeWindow
      }
    },
    get complete() {
      return provider !== 'codex' && provider !== 'claude'
    },
    snapshot(additional: readonly ActivityMapEvent[] = []): TerminalActivityTelemetry {
      for (const fact of pending.toReversed()) {
        apply(fact)
      }
      pending.length = 0
      return {
        cwd,
        modelAt,
        model,
        contextUsage,
        contextAt,
        ...activity.snapshot(additional),
        hostNow: Date.now()
      }
    }
  }
}
