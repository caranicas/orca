// Adapted from lot-map 09f6b93, Copyright (c) 2026 Aleksei Volodin; MIT, see lot-map-LICENSE.txt.
import type { ActivityMapEvent } from './agent-activity-map'

export type ActivityMapFeedRow = { event: ActivityMapEvent; count: number; durationMs?: number }

export function foldActivityMapFeed(
  events: readonly ActivityMapEvent[],
  max = 16
): ActivityMapFeedRow[] {
  const rows: ActivityMapFeedRow[] = []
  for (const event of events.toReversed()) {
    const last = rows.at(-1)
    if (
      last &&
      event.state === 'completed' &&
      !event.mark &&
      last.event.state === 'completed' &&
      !last.event.mark &&
      event.station === last.event.station &&
      (event.station !== 'apps' || event.label === last.event.label) &&
      event.origin === last.event.origin
    ) {
      last.count++
      if (event.durationMs !== undefined) {
        last.durationMs = (last.durationMs ?? 0) + event.durationMs
      }
    } else {
      if (rows.length === max) {
        break
      }
      rows.push({ event, count: 1, durationMs: event.durationMs })
    }
  }
  return rows
}

export function activityMapFaults(events: readonly ActivityMapEvent[]) {
  const faults = new Map<ActivityMapEvent['station'], number>()
  for (const event of events) {
    if (event.mark === 'prompt' && event.origin === 'core') {
      faults.clear()
    }
    if ((event.state === 'failed' || event.state === 'blocked') && event.station !== 'you') {
      faults.set(event.station, (faults.get(event.station) ?? 0) + 1)
    }
  }
  return faults
}
