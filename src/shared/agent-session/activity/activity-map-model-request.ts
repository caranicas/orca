import type { ActivityMapEvent } from './agent-activity-map'
import { matchingActivityMapCompaction } from './activity-map-compaction'

export function activityMapModelRequestKey(turn: unknown, usage: unknown): string | undefined {
  if (typeof turn !== 'string' || !usage || typeof usage !== 'object') {
    return undefined
  }
  const record = Object.fromEntries(Object.entries(usage))
  const fields = [
    'input_tokens',
    'cached_input_tokens',
    'cache_write_input_tokens',
    'output_tokens',
    'reasoning_output_tokens',
    'total_tokens'
  ]
  const counts = fields.map((field) => record[field] ?? 0)
  if (counts.some((count) => typeof count !== 'number' || !Number.isFinite(count) || count < 0)) {
    return undefined
  }
  return JSON.stringify([turn, ...counts])
}

export function reconcileActivityMapModelRequests(
  durable: readonly ActivityMapEvent[],
  live: readonly ActivityMapEvent[],
  knownResponses: readonly ActivityMapEvent[] = []
) {
  const matched = new Set<string>()
  const revisions = new Map<string, ActivityMapEvent>()
  const additional: ActivityMapEvent[] = []
  for (const hook of live) {
    const compaction = matchingActivityMapCompaction(hook, durable)
    if (compaction) {
      revisions.set(compaction.id, {
        ...compaction,
        id: compaction.id,
        ...(hook.durationMs !== undefined
          ? {
              startedAt: hook.startedAt,
              endedAt: hook.endedAt,
              durationMs: hook.durationMs,
              durationEstimated: hook.durationEstimated
            }
          : {})
      })
      continue
    }
    const response =
      hook.requestKey || hook.transcriptIds?.length
        ? [...knownResponses, ...durable].findLast(
            (event) =>
              !matched.has(event.id) &&
              event.origin === hook.origin &&
              event.agentId === hook.agentId &&
              (hook.transcriptIds?.some((id) => event.transcriptIds?.includes(id)) ||
                (hook.requestKey !== undefined &&
                  hook.state === 'completed' &&
                  event.requestKey === hook.requestKey &&
                  event.startedAt <= (hook.endedAt ?? hook.startedAt) &&
                  (hook.durationMs === undefined || event.startedAt >= hook.startedAt)))
          )
        : undefined
    if (!response) {
      additional.push(hook)
      continue
    }
    matched.add(response.id)
    revisions.set(response.id, {
      ...response,
      ...(hook.transcriptIds?.length ? { ...hook, id: response.id } : {}),
      ...(hook.durationMs !== undefined
        ? {
            startedAt: hook.startedAt,
            endedAt: hook.endedAt,
            durationMs: hook.durationMs,
            durationEstimated: hook.durationEstimated
          }
        : {})
    })
  }
  return {
    durable: durable.map((event) => revisions.get(event.id) ?? event),
    additional,
    revisions: [...revisions.values()]
  }
}
