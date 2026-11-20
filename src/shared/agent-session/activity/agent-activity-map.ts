import { activityMapChildBlocks } from './activity-map-child-blocks'
import { activityMapJournalFact } from './activity-map-journal-fact'
import { activityMapToolDetails } from './activity-map-tool-details'
export { activityMapToolDetails } from './activity-map-tool-details'
import { agentJournalToolCallLifecycle } from '../journal/agent-journal-tool-call-lifecycle'
import { compareAgentJournalItems } from '../journal/agent-session-journal-position'
import { isRootAgentJournalItem } from '../journal/agent-session-journal-producer'
import { clean, lastTwo } from './activity-map-labels'
import { isKnownHarnessInjectedUserTurnText } from '../journal/harness-injected-user-turns'
import type { ActivityMapClassificationOptions } from './activity-map-classification-options'
import type { AgentJournalRenderItem } from '../journal/agent-session-journal-types'
import type { StructuredAgentContextUsage } from '../conversation-context/structured-agent-session-context-usage'

export type ActivityMapStation =
  | 'you'
  | 'model'
  | 'memory'
  | 'files'
  | 'shell'
  | 'network'
  | 'browser'
  | 'agents'
  | 'skills'
  | 'hooks'

export type ActivityMapState =
  | 'running'
  | 'completed'
  | 'failed'
  | 'blocked'
  | 'interrupted'
  | 'unknown'
  | 'waiting'
  | 'observed'

export type ActivityMapEvent = {
  id: string
  station: ActivityMapStation
  origin: 'core' | 'agents'
  state: ActivityMapState
  label: string
  startedAt: number
  durationMs?: number
  durationEstimated?: boolean
  endedAt?: number
  callId?: string
  agentId?: string
  taskId?: string
  requestKey?: string
  transcriptIds?: string[]
  inbound?: boolean
  observationId?: string
  context?: { model: string; usage: StructuredAgentContextUsage | null }
  mark?: 'child' | 'prompt' | 'metadata' | 'step' | 'switch' | 'compact' | 'done' | 'interrupted'
}

function projectItem(
  item: AgentJournalRenderItem,
  options?: ActivityMapClassificationOptions
): ActivityMapEvent | null {
  const body = item.body
  const fact = activityMapJournalFact(item)
  if (fact) {
    return fact
  }
  const event: ActivityMapEvent = {
    id: item.itemId,
    station: 'you',
    origin: !isRootAgentJournalItem(item) && item.producerKind !== 'background' ? 'agents' : 'core',
    state: 'observed',
    label: '',
    startedAt: item.observedAt
  }
  if (body.kind === 'tool-call') {
    return {
      ...event,
      ...activityMapToolDetails(body, options),
      ...(body.callId ? { callId: body.callId } : {}),
      ...(item.agentId ? { agentId: item.agentId } : {}),
      state:
        body.endedAs === 'unverifiable'
          ? 'unknown'
          : (agentJournalToolCallLifecycle(body) ?? 'unknown'),
      ...(body.durationMs !== undefined ? { durationMs: body.durationMs } : {})
    }
  }
  if (body.kind === 'turn' && isRootAgentJournalItem(item) && body.state !== 'running') {
    const successful = body.state === 'completed' && body.outcome === 'success'
    return {
      ...event,
      station: 'you',
      state: successful
        ? 'completed'
        : body.state === 'interrupted' || body.outcome === 'cancellation'
          ? 'interrupted'
          : body.outcome === 'failure'
            ? 'failed'
            : 'unknown',
      label: successful
        ? 'Answer ready'
        : body.outcome === 'failure'
          ? 'Turn failed'
          : 'Turn ended',
      startedAt: body.completedAt ?? item.observedAt,
      ...(body.durationMs !== undefined ? { durationMs: body.durationMs } : {}),
      ...(successful ? { mark: 'done' } : {})
    }
  }
  if (body.kind === 'diff') {
    return { ...event, station: 'files', label: clean(lastTwo(body.path)) }
  }
  if (body.kind === 'approval' || body.kind === 'question') {
    return {
      ...event,
      station: 'you',
      label: body.kind === 'approval' ? 'Approval' : 'Question',
      state:
        body.resolution.state === 'pending'
          ? 'waiting'
          : body.resolution.state === 'cancelled'
            ? 'interrupted'
            : 'completed'
    }
  }
  if (body.kind === 'agent-start' || body.kind === 'agent-handoff') {
    return { ...event, station: 'agents', label: 'Agent launched' }
  }
  if (body.kind !== 'message') {
    return null
  }
  if (body.role === 'reasoning') {
    return null
  }
  if (body.role === 'user') {
    const text = body.blocks
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('')
      .trim()
    if (!body.from && isKnownHarnessInjectedUserTurnText(text)) {
      return null
    }
    return {
      ...event,
      station: body.from ? 'agents' : 'you',
      label: 'Message',
      ...(!body.from && event.origin === 'core' ? { mark: 'prompt' as const } : {})
    }
  }
  return null
}

/** Project the loaded journal, including revised calls, without retaining arguments or output. */
export function projectAgentActivityMap(
  items: readonly AgentJournalRenderItem[],
  options?: ActivityMapClassificationOptions
): ActivityMapEvent[] {
  return [...items].sort(compareAgentJournalItems).flatMap((item) => {
    const event = projectItem(item, options)
    const children =
      item.body.kind === 'message'
        ? activityMapChildBlocks(item.body.blocks, {
            id: item.itemId,
            origin: isRootAgentJournalItem(item) ? 'core' : 'agents',
            startedAt: item.observedAt
          })
        : []
    return [...(event ? [event] : []), ...children]
  })
}
