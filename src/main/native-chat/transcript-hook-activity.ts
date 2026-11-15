import type { ActivityMapEvent } from '../../shared/agent-session/activity/agent-activity-map'
import type { AgentHookEventPayload } from '../../shared/agent-hook-listener/listener-event'
import { agentMainAgentVerdict } from '../../shared/agent-status/lifecycle/agent-main-agent-verdict'
import type { AgentStatusObservation } from '../../shared/agent-status/contracts/agent-status-observation'
import { activityMapEventKey } from '../../shared/agent-session/activity/activity-map-statistics'
import { isLocalHookConnectionId } from '../../shared/wsl-hook-relay-contract'

export type TranscriptHookObservation = AgentHookEventPayload & {
  receivedAt: number
  evidenceObservedAt?: number
  observation?: AgentStatusObservation
}
export type SubscribeTranscriptHookActivity = (
  listener: (event: TranscriptHookObservation) => void
) => () => void

type HookActivityCheckpoint = {
  events: ActivityMapEvent[]
  open: Map<string, string>
  serial: number
  seen?: Set<string>
  facts?: Map<string, ActivityMapEvent>
}

export function createTranscriptHookActivity(input: {
  paneKey?: string
  sessionId: string
  subscribe?: SubscribeTranscriptHookActivity
  onChange: () => void
  checkpoint?: HookActivityCheckpoint
}) {
  let events: ActivityMapEvent[] = [...(input.checkpoint?.events ?? [])]
  let serial = input.checkpoint?.serial ?? 0
  const open = new Map(input.checkpoint?.open)
  const seen = new Set(input.checkpoint?.seen)
  const facts = new Map(input.checkpoint?.facts)
  const remember = () => {
    for (const event of events) {
      if (event.mark !== 'metadata') {
        facts.set(activityMapEventKey(event), event)
      }
    }
  }
  const stop =
    input.subscribe?.((row) => {
      if (
        row.isReplay ||
        (row.observation !== undefined && row.observation.origin !== 'hook') ||
        row.providerSessionOnly ||
        !isLocalHookConnectionId(row.connectionId) ||
        (input.paneKey && row.paneKey !== input.paneKey) ||
        (row.providerSession?.id ?? row.statusAdmissionSession) !== input.sessionId
      ) {
        return
      }
      const at = row.evidenceObservedAt ?? row.receivedAt
      const observationId = row.activityMapEvent?.observationId
      if (observationId) {
        if (seen.has(observationId)) {
          return
        }
        seen.add(observationId)
        if (seen.size > 1024) {
          seen.delete(seen.values().next().value!)
        }
      }
      if (row.hookEventName === 'SubagentStop' && row.toolAgentId) {
        events = events.map((event) =>
          (event.agentId === row.toolAgentId || event.taskId === row.toolAgentId) &&
          (event.state === 'running' || event.state === 'waiting')
            ? { ...event, state: 'unknown', endedAt: at }
            : event
        )
        remember()
        input.onChange()
        return
      }
      if (!row.toolAgentId && (row.hookEventName === 'Stop' || row.hookEventName === 'Interrupt')) {
        events = events.map((event) =>
          event.origin === 'core' &&
          (event.state === 'running' || event.state === 'waiting') &&
          !event.taskId
            ? {
                ...event,
                state:
                  row.hookEventName === 'Interrupt' || row.payload.interrupted
                    ? 'interrupted'
                    : 'unknown',
                endedAt: at
              }
            : event
        )
        const verdict = agentMainAgentVerdict(row.payload)
        if (verdict === 'success' || verdict === 'failure' || verdict === 'cancellation') {
          events.push({
            id: `turn:${row.nativeTurnKey ?? row.providerPromptId ?? row.turnEndedAt ?? at}`,
            station: 'you',
            origin: 'core',
            startedAt: at,
            label:
              verdict === 'success'
                ? 'Answer ready'
                : verdict === 'failure'
                  ? 'Turn failed'
                  : 'Interrupted',
            state:
              verdict === 'success'
                ? 'completed'
                : verdict === 'failure'
                  ? 'failed'
                  : 'interrupted',
            ...(verdict === 'success' ? { mark: 'done' } : {})
          })
        }
        remember()
        input.onChange()
        return
      }
      const fact = row.activityMapEvent
      if (!fact) {
        return
      }
      if (row.hookEventName === 'PostToolUse' || row.hookEventName === 'PostToolUseFailure') {
        events = events.map((event) =>
          event.id.startsWith(`hook:permission:${fact.callId}:`) && event.state === 'waiting'
            ? { ...event, state: 'completed', endedAt: at }
            : event
        )
      }
      const key = `${fact.origin}:${fact.agentId ?? 'core'}:${fact.id}`
      const activeId = open.get(key)
      const previous = activeId ? events.find((event) => event.id === activeId) : undefined
      const id = fact.callId
        ? `call:${fact.origin}:${fact.agentId ?? 'core'}:${fact.callId}`
        : row.hookEventName === 'OrcaActivity'
          ? `native:${fact.id}`
          : (activeId ?? `hook:${fact.id}:${++serial}`)
      const stored = events.find((event) => event.id === id)
      if (
        stored &&
        stored.state !== 'running' &&
        stored.state !== 'waiting' &&
        fact.state === 'running' &&
        !fact.taskId
      ) {
        return
      }
      if (
        fact.state === 'running' ||
        (fact.mark === 'compact' && row.hookEventName === 'PreCompact')
      ) {
        open.set(key, id)
      } else {
        open.delete(key)
      }
      const event: ActivityMapEvent = {
        ...stored,
        ...fact,
        ...(previous ? { station: previous.station, label: previous.label } : {}),
        id,
        startedAt: previous?.startedAt ?? (fact.startedAt > 0 ? fact.startedAt : at),
        durationEstimated:
          previous?.durationEstimated ?? fact.durationEstimated ?? fact.startedAt <= 0,
        ...(fact.state !== 'running' && previous && fact.durationMs === undefined
          ? {
              durationMs: Math.max(0, (fact.endedAt ?? at) - previous.startedAt),
              endedAt: fact.endedAt ?? at
            }
          : {})
      }
      const next = [...events.filter((item) => item.id !== id), event]
      if (event.mark !== 'metadata') {
        facts.set(activityMapEventKey(event), event)
      }
      const recent = new Set(next.slice(-80))
      const context = next.findLast((item) => item.context)
      events = next.filter(
        (item) =>
          item === context ||
          recent.has(item) ||
          item.state === 'running' ||
          item.state === 'waiting'
      )
      input.onChange()
    }) ?? (() => {})
  return {
    events: () => events,
    facts: () => [...facts.values()],
    checkpoint: (): HookActivityCheckpoint => ({ events, open, serial, seen, facts }),
    reset: () => {
      events = []
      open.clear()
      seen.clear()
      facts.clear()
    },
    dispose: stop
  }
}
