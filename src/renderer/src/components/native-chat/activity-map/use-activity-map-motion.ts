import { useEffect, useRef, useState } from 'react'
import type { ActivityMapEvent } from '../../../../../shared/agent-session/activity/agent-activity-map'

export type ActivityMapFlight = {
  key: string
  event: ActivityMapEvent
  returning: boolean
  delay: number
  lane: number
}

export function useActivityMapMotion(events: readonly ActivityMapEvent[], live: boolean) {
  const previous = useRef<{ events: readonly ActivityMapEvent[]; live: boolean } | null>(null)
  const [flights, setFlights] = useState<ActivityMapFlight[]>([])
  const [answer, setAnswer] = useState(0)

  useEffect(() => {
    const before = previous.current
    previous.current = { events, live }
    if (!live || !before || (!before.live && before.events.length === 0)) {
      return
    }
    const old = new Map(before?.events.map((event) => [event.id, event]))
    const latest = before.events.length
      ? before.events.reduce((time, event) => Math.min(time, event.startedAt), Infinity)
      : Number.NEGATIVE_INFINITY
    const next: ActivityMapFlight[] = []
    for (const event of events.slice(-20)) {
      const prior = old.get(event.id)
      const ended =
        event.state === 'completed' ||
        event.state === 'failed' ||
        event.state === 'blocked' ||
        event.state === 'interrupted'
      // Older history and the initial snapshot must not replay as new activity.
      const observedAt =
        event.endedAt ??
        (ended && event.durationMs !== undefined
          ? event.startedAt + event.durationMs
          : event.startedAt)
      const added = !prior && observedAt >= latest
      if (added) {
        next.push({ key: `${event.id}:out`, event, returning: false, delay: 0, lane: 0 })
      }
      if (
        ended &&
        !event.inbound &&
        event.station !== 'you' &&
        (added || (prior && prior.state !== event.state))
      ) {
        next.push({
          key: `${event.id}:back`,
          event,
          returning: true,
          delay: added ? 0.8 : 0,
          lane: 0
        })
      }
    }
    for (const flight of next) {
      const peers = next.filter(
        (other) =>
          other.event.station === flight.event.station &&
          other.event.origin === flight.event.origin &&
          other.returning === flight.returning
      )
      flight.lane = (peers.indexOf(flight) - (peers.length - 1) / 2) * 5
    }
    if (next.length) {
      setFlights((current) => [...current, ...next].slice(-40))
    }
    if (next.some((flight) => flight.event.mark === 'done' && !flight.returning)) {
      setAnswer((current) => current + 1)
    }
  }, [events, live])

  const finish = (key: string) =>
    setFlights((current) => current.filter((flight) => flight.key !== key))
  return { flights, answer, finish }
}
