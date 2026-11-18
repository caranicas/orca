import type { NativeChatMessage } from '../../native-chat/native-chat-types'
import { namedSubagents } from '../../native-chat/transcript/subagents/native-chat-subagent-items'
import type { AgentStatusEntry } from '../../agent-status/contracts/agent-status-types'
import type { StructuredAgentSubagentRosterEntry } from '../view/structured-agent-session-subagent-roster'
import type { ActivityMapEvent, ActivityMapState } from './agent-activity-map'
import { activityMapToolDetails } from './agent-activity-map'

export function terminalActivityChildWork(
  status: Pick<AgentStatusEntry, 'children' | 'subagents'> | undefined,
  messages: readonly NativeChatMessage[] = []
) {
  const roster = new Map<string, StructuredAgentSubagentRosterEntry>()
  const events: ActivityMapEvent[] = []
  for (const [index, message] of messages.entries()) {
    for (const entry of message.blocks.flatMap(namedSubagents)) {
      roster.set(entry.id, {
        entry,
        rosterItemId: message.id,
        rosterPosition: { sequence: index, index: 0 },
        rosterRevision: index + 1
      })
    }
  }
  for (const child of status?.children ?? []) {
    const state: ActivityMapState =
      child.membership === 'settled'
        ? child.outcome === 'failed'
          ? 'failed'
          : child.outcome === 'cancelled'
            ? 'interrupted'
            : child.outcome === 'succeeded'
              ? 'completed'
              : 'unknown'
        : child.state === 'working' || child.state === 'monitoring'
          ? 'running'
          : child.state === 'waiting' || child.state === 'blocked'
            ? 'waiting'
            : child.state === 'unverifiable'
              ? 'unknown'
              : 'observed'
    const id = `child:${child.id}:${child.invocation.generation}`
    const label = (child.name ?? child.description ?? child.providerId ?? child.kind)
      .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
      .slice(0, 120)
    events.push({
      id,
      callId: child.invocation.invocationId,
      mark: 'child',
      taskId: child.providerId ?? child.id,
      station: child.kind === 'agent' || child.kind === 'workflow' ? 'agents' : 'shell',
      origin: child.parentChildWorkId ? 'agents' : 'core',
      label,
      state,
      startedAt: child.providerTiming?.startedAt ?? child.firstObservedAt,
      durationEstimated: child.providerTiming?.startedAt === undefined,
      ...(child.settledAt !== undefined
        ? {
            endedAt: child.providerTiming?.completedAt ?? child.settledAt,
            durationMs: Math.max(
              0,
              (child.providerTiming?.completedAt ?? child.settledAt) -
                (child.providerTiming?.startedAt ?? child.firstObservedAt)
            ),
            durationEstimated:
              child.providerTiming?.startedAt === undefined ||
              child.providerTiming.completedAt === undefined
          }
        : {})
    })
    if (child.kind === 'agent') {
      roster.set(child.providerId ?? child.id, {
        entry: {
          id: child.providerId ?? child.id,
          label,
          state:
            state === 'running' || state === 'waiting'
              ? 'working'
              : state === 'completed'
                ? 'completed'
                : state === 'failed'
                  ? 'failed'
                  : state === 'interrupted'
                    ? 'stopped'
                    : state === 'unknown'
                      ? 'unverifiable'
                      : 'idle',
          startedAt: child.firstObservedAt,
          settledAt: child.settledAt
        },
        rosterItemId: id,
        rosterPosition: { sequence: 0, index: 0 },
        rosterRevision: child.invocation.generation
      })
      if (child.operation) {
        events.push({
          id: `${id}:operation:${child.operation.observedAt}`,
          ...activityMapToolDetails({ name: child.operation.toolName, input: null }),
          origin: 'agents',
          agentId: child.providerId ?? child.id,
          state: child.operation.basis === 'open' ? 'running' : 'observed',
          startedAt: child.operation.observedAt
        })
      }
    }
  }
  if (!status?.children) {
    for (const child of status?.subagents ?? []) {
      roster.set(child.id, {
        entry: {
          id: child.id,
          label: child.description?.slice(0, 120) ?? child.id,
          state:
            child.state === 'unverifiable'
              ? 'unverifiable'
              : child.state === 'idle'
                ? 'idle'
                : 'working',
          startedAt: child.startedAt
        },
        rosterItemId: `hook:${child.id}`,
        rosterPosition: { sequence: 0, index: 0 },
        rosterRevision: 1
      })
    }
  }
  return { roster, events }
}
