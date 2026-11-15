import type { ActivityMapEvent, ActivityMapStation } from './agent-activity-map'

export type ActivityMapStatistics = {
  counts: Partial<Record<ActivityMapStation, number>>
  faults: Partial<Record<ActivityMapStation, number>>
  clearedAt: number
  pushed?: number
}

export function activityMapEventKey(event: ActivityMapEvent): string {
  return event.callId ? `call:${event.origin}:${event.agentId ?? 'core'}:${event.callId}` : event.id
}

export function createActivityMapStatistics(
  seed?: ActivityMapStatistics,
  events: readonly ActivityMapEvent[] = []
) {
  const requests = new Map<string, ActivityMapEvent>()
  const state = {
    counts: { ...seed?.counts },
    faults: { ...seed?.faults },
    clearedAt: seed?.clearedAt ?? 0,
    pushed: seed?.pushed ?? 0,
    seen: new Map(events.map((event) => [activityMapEventKey(event), event.state])),
    counted: new Set(
      events
        .filter(
          (event) => event.mark !== 'switch' && event.mark !== 'child' && event.mark !== 'metadata'
        )
        .map(activityMapEventKey)
    )
  }
  function observe(event: ActivityMapEvent, target = state) {
    if (event.mark === 'metadata') {
      return
    }
    const { counts, faults, seen } = target
    let { clearedAt } = target
    const key = activityMapEventKey(event)
    const before = seen.get(key) ?? (target === state ? undefined : state.seen.get(key))
    if (
      target === state &&
      event.mark === 'step' &&
      (event.requestKey || event.transcriptIds?.length)
    ) {
      requests.set(key, event)
    }
    if (
      before === undefined &&
      event.mark === 'prompt' &&
      event.origin === 'core' &&
      event.startedAt >= clearedAt
    ) {
      for (const station of Object.keys(faults)) {
        Reflect.deleteProperty(faults, station)
      }
      clearedAt = event.startedAt
    }
    if (before === undefined && event.inbound && event.station === 'memory') {
      target.pushed++
    }
    const counted = target.counted.has(key) || (target !== state && state.counted.has(key))
    if (!counted && event.mark !== 'switch' && event.mark !== 'child') {
      counts[event.station] = (counts[event.station] ?? 0) + 1
      target.counted.add(key)
    }
    if (
      (event.state === 'failed' || event.state === 'blocked') &&
      before !== 'failed' &&
      before !== 'blocked' &&
      event.station !== 'you' &&
      (event.endedAt ?? event.startedAt) >= clearedAt
    ) {
      faults[event.station] = (faults[event.station] ?? 0) + 1
    }
    seen.set(key, event.state)
    target.clearedAt = clearedAt
  }
  return {
    observe,
    modelRequests: () => [...requests.values()],
    snapshot(additional: readonly ActivityMapEvent[] = []): ActivityMapStatistics {
      const next = {
        counts: { ...state.counts },
        faults: { ...state.faults },
        clearedAt: state.clearedAt,
        pushed: state.pushed,
        seen: new Map<string, ActivityMapEvent['state']>(),
        counted: new Set<string>()
      }
      for (const event of additional) {
        observe(event, next)
      }
      return {
        counts: next.counts,
        faults: next.faults,
        clearedAt: next.clearedAt,
        pushed: next.pushed
      }
    }
  }
}
