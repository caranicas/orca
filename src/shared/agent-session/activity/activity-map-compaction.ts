import type { ActivityMapEvent } from './agent-activity-map'

export function matchingActivityMapCompaction(
  event: ActivityMapEvent,
  known: readonly ActivityMapEvent[]
) {
  if (event.mark !== 'compact') {
    return undefined
  }
  const matches = known.filter((prior) => {
    if (
      prior.mark !== 'compact' ||
      prior.origin !== event.origin ||
      prior.agentId !== event.agentId
    ) {
      return false
    }
    const interval =
      event.endedAt !== undefined && event.endedAt > event.startedAt
        ? event
        : prior.endedAt !== undefined && prior.endedAt > prior.startedAt
          ? prior
          : null
    const point = interval === event ? prior : event
    const end = interval?.endedAt
    return (
      interval !== null &&
      end !== undefined &&
      point.startedAt >= interval.startedAt &&
      (point.endedAt ?? point.startedAt) <= end
    )
  })
  return matches.length === 1 ? matches[0] : undefined
}
