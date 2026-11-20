import type { ActivityMapStatistics } from './activity-map-statistics'
import type { ActivityMapEvent } from './agent-activity-map'
import type { StructuredAgentContextUsage } from '../conversation-context/structured-agent-session-context-usage'

export type TerminalActivityTelemetry = {
  cwd?: string
  modelAt?: number
  model: string | null
  contextUsage: StructuredAgentContextUsage | null
  /** Host clock accompanying this snapshot, never a renderer receipt timestamp. */
  statistics?: ActivityMapStatistics
  coreModelCount?: number
  contextAt?: number
  hostNow: number
  events: ActivityMapEvent[]
}

/** Matches Codex's status line: cached/reasoning tokens are already part of last.total_tokens. */
export function codexContextPercentage(used: number, window: number): number {
  if (window <= 12_000) {
    return 100
  }
  const remaining = Math.max(0, window - 12_000 - Math.max(0, used - 12_000))
  return 100 - Math.round(Math.min(100, (remaining / (window - 12_000)) * 100))
}

export function readTerminalActivityTelemetry(
  value: unknown
): TerminalActivityTelemetry | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }
  const record: Record<string, unknown> = Object.fromEntries(Object.entries(value))
  if (
    (record.model !== null && typeof record.model !== 'string') ||
    typeof record.hostNow !== 'number' ||
    !Number.isFinite(record.hostNow) ||
    !Array.isArray(record.events)
  ) {
    return undefined
  }
  const context =
    typeof record.contextUsage === 'object' && record.contextUsage !== null
      ? Object.fromEntries(Object.entries(record.contextUsage))
      : null
  const contextUsage =
    context &&
    typeof context.usedTokens === 'number' &&
    Number.isFinite(context.usedTokens) &&
    context.usedTokens >= 0 &&
    typeof context.windowTokens === 'number' &&
    Number.isFinite(context.windowTokens) &&
    context.windowTokens > 0 &&
    typeof context.percentage === 'number' &&
    Number.isFinite(context.percentage)
      ? {
          usedTokens: context.usedTokens,
          windowTokens: context.windowTokens,
          percentage: context.percentage,
          estimated: context.estimated === true,
          categories: []
        }
      : null
  const stations = [
    'you',
    'model',
    'memory',
    'files',
    'shell',
    'network',
    'browser',
    'agents',
    'skills',
    'hooks'
  ] as const
  const states = [
    'running',
    'completed',
    'failed',
    'blocked',
    'interrupted',
    'unknown',
    'waiting',
    'observed'
  ] as const
  const marks = [
    'child',
    'prompt',
    'metadata',
    'step',
    'switch',
    'compact',
    'done',
    'interrupted'
  ] as const
  const events: ActivityMapEvent[] = []
  for (const raw of record.events.slice(-512)) {
    if (typeof raw !== 'object' || raw === null) {
      continue
    }
    const event = Object.fromEntries(Object.entries(raw))
    const station = stations.find((id) => id === event.station)
    const state = states.find((id) => id === event.state)
    const mark = marks.find((id) => id === event.mark)
    if (
      !station ||
      !state ||
      typeof event.id !== 'string' ||
      typeof event.label !== 'string' ||
      typeof event.startedAt !== 'number' ||
      !Number.isFinite(event.startedAt)
    ) {
      continue
    }
    events.push({
      id: event.id.slice(0, 512),
      label: event.label.slice(0, 120),
      station,
      state,
      origin: event.origin === 'agents' ? 'agents' : 'core',
      startedAt: event.startedAt,
      ...(event.inbound === true ? { inbound: true } : {}),
      ...(event.durationEstimated === true ? { durationEstimated: true } : {}),
      ...(typeof event.observationId === 'string'
        ? { observationId: event.observationId.slice(0, 128) }
        : {}),
      ...(typeof event.callId === 'string' ? { callId: event.callId.slice(0, 256) } : {}),
      ...(typeof event.agentId === 'string' ? { agentId: event.agentId.slice(0, 256) } : {}),
      ...(typeof event.taskId === 'string' ? { taskId: event.taskId.slice(0, 256) } : {}),
      ...(typeof event.requestKey === 'string'
        ? { requestKey: event.requestKey.slice(0, 512) }
        : {}),
      ...(Array.isArray(event.transcriptIds)
        ? {
            transcriptIds: event.transcriptIds
              .filter((id): id is string => typeof id === 'string')
              .slice(0, 64)
              .map((id) => id.slice(0, 256))
          }
        : {}),
      ...(typeof event.endedAt === 'number' && Number.isFinite(event.endedAt)
        ? { endedAt: event.endedAt }
        : {}),
      ...(typeof event.durationMs === 'number' &&
      Number.isFinite(event.durationMs) &&
      event.durationMs >= 0
        ? { durationMs: event.durationMs }
        : {}),
      ...(mark ? { mark } : {}),
      ...(mark === 'metadata' && typeof event.context === 'object' && event.context !== null
        ? (() => {
            const context = Object.fromEntries(Object.entries(event.context))
            const report = readTerminalActivityTelemetry({
              model: context.model,
              contextUsage: context.usage,
              hostNow: 0,
              events: []
            })
            return report?.model
              ? { context: { model: report.model, usage: report.contextUsage } }
              : {}
          })()
        : {})
    })
  }
  return {
    ...(typeof record.coreModelCount === 'number' &&
    Number.isSafeInteger(record.coreModelCount) &&
    record.coreModelCount >= 0
      ? { coreModelCount: record.coreModelCount }
      : {}),
    ...(typeof record.cwd === 'string' ? { cwd: record.cwd.slice(0, 4096) } : {}),
    ...(typeof record.modelAt === 'number' && Number.isFinite(record.modelAt)
      ? { modelAt: record.modelAt }
      : {}),
    model: record.model?.slice(0, 256) ?? null,
    contextUsage,
    ...(readActivityMapStatistics(record.statistics, stations)
      ? { statistics: readActivityMapStatistics(record.statistics, stations)! }
      : {}),
    ...(typeof record.contextAt === 'number' && Number.isFinite(record.contextAt)
      ? { contextAt: record.contextAt }
      : {}),
    hostNow: record.hostNow,
    events
  }
}

export function readActivityMapEvent(value: unknown): ActivityMapEvent | undefined {
  return readTerminalActivityTelemetry({
    model: null,
    contextUsage: null,
    hostNow: 0,
    events: [value]
  })?.events[0]
}

function readActivityMapStatistics(
  value: unknown,
  stations: readonly ActivityMapEvent['station'][]
): ActivityMapStatistics | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }
  const record = Object.fromEntries(Object.entries(value))
  if (typeof record.clearedAt !== 'number' || !Number.isFinite(record.clearedAt)) {
    return undefined
  }
  const readCounts = (value: unknown) => {
    const raw = value && typeof value === 'object' ? Object.fromEntries(Object.entries(value)) : {}
    return Object.fromEntries(
      stations.flatMap((station) =>
        typeof raw[station] === 'number' && Number.isSafeInteger(raw[station]) && raw[station] >= 0
          ? [[station, raw[station]]]
          : []
      )
    )
  }
  return {
    counts: readCounts(record.counts),
    faults: readCounts(record.faults),
    clearedAt: record.clearedAt,
    ...(typeof record.pushed === 'number' &&
    Number.isSafeInteger(record.pushed) &&
    record.pushed >= 0
      ? { pushed: record.pushed }
      : {})
  }
}
