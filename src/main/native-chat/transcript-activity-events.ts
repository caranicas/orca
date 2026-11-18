import {
  createActivityMapStatistics,
  activityMapEventKey
} from '../../shared/agent-session/activity/activity-map-statistics'
import type { ActivityMapEvent } from '../../shared/agent-session/activity/agent-activity-map'
import type { TerminalActivityTelemetry } from '../../shared/agent-session/activity/terminal-activity-telemetry'
import type { TranscriptActivityFact } from './transcript-activity-fact'
import { matchingActivityMapCompaction } from '../../shared/agent-session/activity/activity-map-compaction'

export function createTranscriptActivityEvents(seed?: TerminalActivityTelemetry) {
  let events = seed?.events ?? []
  const statistics = createActivityMapStatistics(seed?.statistics, events)
  const core =
    seed && seed.coreModelCount === undefined
      ? null
      : createActivityMapStatistics(
          { counts: { model: seed?.coreModelCount ?? 0 }, faults: {}, clearedAt: 0 },
          events
        )
  const coreModel = (event: ActivityMapEvent) =>
    event.station === 'model' && event.origin === 'core'
  function count(event: ActivityMapEvent) {
    statistics.observe(event)
    if (coreModel(event)) {
      core?.observe(event)
    }
  }
  function observe(fact: Pick<TranscriptActivityFact, 'event' | 'decoded'>) {
    for (const observed of [
      ...(fact.decoded?.events ?? []),
      ...(fact.event && fact.event.mark !== 'metadata' ? [fact.event] : [])
    ]) {
      const sameCompaction = matchingActivityMapCompaction(observed, events)
      const interval = observed.endedAt !== undefined ? observed : sameCompaction
      const event = sameCompaction
        ? {
            ...observed,
            id: sameCompaction.id,
            ...(interval
              ? {
                  startedAt: interval.startedAt,
                  endedAt: interval.endedAt,
                  durationMs: interval.durationMs
                }
              : {})
          }
        : observed
      const key = activityMapEventKey(event)
      const prior = events.find((row) => activityMapEventKey(row) === key)
      const next = { ...prior, ...event, id: key }
      if (prior?.transcriptIds || event.transcriptIds) {
        next.transcriptIds = [
          ...new Set([...(prior?.transcriptIds ?? []), ...(event.transcriptIds ?? [])])
        ].slice(-64)
      }
      count(next)
      events = [...events.filter((row) => activityMapEventKey(row) !== key), next]
    }
    for (const result of fact.decoded?.results ?? []) {
      events = events.map((event) => {
        if (
          event.callId !== result.callId ||
          event.agentId !== result.agentId ||
          event.origin !== result.origin
        ) {
          return event
        }
        const next = {
          ...event,
          state: result.state,
          ...(result.durationMs !== undefined
            ? { durationMs: result.durationMs, durationEstimated: false }
            : {}),
          ...(result.taskId ? { taskId: result.taskId } : {}),
          ...(result.state !== 'running' ? { endedAt: result.endedAt } : {})
        }
        count(next)
        return next
      })
    }
    for (const notice of fact.decoded?.notices ?? []) {
      events = events.map((event) => {
        if (event.taskId !== notice.taskId || !notice.status) {
          return event
        }
        const state =
          notice.status === 'failed'
            ? 'failed'
            : notice.status === 'completed'
              ? 'completed'
              : notice.status === 'stopped' || notice.status === 'cancelled'
                ? 'interrupted'
                : null
        if (!state) {
          return event
        }
        const next: ActivityMapEvent = { ...event, state, endedAt: notice.endedAt }
        count(next)
        return next
      })
    }
    const recent = new Set(events.slice(-80))
    events = events.filter(
      (event) => recent.has(event) || event.state === 'running' || event.state === 'waiting'
    )
  }
  return {
    observe,
    modelRequests: statistics.modelRequests,
    snapshot: (additional: readonly ActivityMapEvent[] = []) => ({
      events,
      statistics: statistics.snapshot(additional),
      ...(core
        ? { coreModelCount: core.snapshot(additional.filter(coreModel)).counts.model ?? 0 }
        : {})
    })
  }
}
