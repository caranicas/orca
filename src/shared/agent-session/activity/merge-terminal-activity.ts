import type { ActivityMapEvent } from './agent-activity-map'
import { activityMapEventKey } from './activity-map-statistics'

function childParent(child: ActivityMapEvent, rows: Iterable<ActivityMapEvent>) {
  const events = [...rows]
  const explicit = child.callId ? events.filter((event) => event.callId === child.callId) : []
  if (explicit.length === 1) {
    return explicit[0]
  }
  const tasks = events.filter(
    (event) =>
      event.taskId &&
      event.taskId === child.taskId &&
      event.startedAt <= child.startedAt &&
      (event.endedAt === undefined || event.endedAt >= child.startedAt)
  )
  return tasks.length === 1 ? tasks[0] : undefined
}

export function mergeTerminalActivity(
  projected: readonly ActivityMapEvent[],
  observations: readonly ActivityMapEvent[],
  children: readonly ActivityMapEvent[]
) {
  const events = new Map<string, ActivityMapEvent>()
  const childFacts = [...projected, ...observations, ...children].filter(
    (event) => event.mark === 'child'
  )
  for (const event of projected.filter((event) => event.mark !== 'child')) {
    const id = activityMapEventKey(event)
    events.set(id, { ...event, id })
  }
  for (const observed of observations.filter((event) => event.mark !== 'child')) {
    const id = activityMapEventKey(observed)
    const prior = events.get(id)
    const resolved =
      prior && ['completed', 'failed', 'blocked', 'interrupted'].includes(prior.state)
    events.set(id, {
      ...prior,
      ...observed,
      id,
      ...(prior ? { station: prior.station, label: prior.label } : {}),
      ...(resolved &&
      (observed.state === 'running' ||
        observed.state === 'unknown' ||
        prior.state === 'failed' ||
        prior.state === 'blocked')
        ? { state: prior.state }
        : {}),
      ...(prior?.durationMs !== undefined
        ? { durationMs: prior.durationMs, durationEstimated: prior.durationEstimated }
        : {})
    })
  }
  for (const child of [...childFacts, ...children.filter((event) => event.mark !== 'child')]) {
    const parent = child.mark === 'child' ? childParent(child, events.values()) : undefined
    if (
      !parent ||
      (['failed', 'blocked', 'interrupted'].includes(parent.state) && parent.state !== child.state)
    ) {
      events.set(child.id, child)
      continue
    }
    const active = child.state === 'running' || child.state === 'waiting'
    const event: ActivityMapEvent = {
      ...parent,
      taskId: child.taskId,
      state: child.state,
      ...(child.endedAt !== undefined ? { endedAt: child.endedAt } : {}),
      ...(child.durationMs !== undefined
        ? { durationMs: child.durationMs, durationEstimated: child.durationEstimated }
        : {})
    }
    if (active) {
      delete event.endedAt
      delete event.durationMs
    }
    events.set(parent.id, event)
  }
  return [...events.values()].sort((a, b) => a.startedAt - b.startedAt)
}
