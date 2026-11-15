import { namedSubagents } from '../../native-chat/transcript/native-chat-subagent-items'
import type { NativeChatBlock, NativeChatSubagentState } from '../../native-chat/native-chat-types'
import type { ActivityMapEvent, ActivityMapState } from './agent-activity-map'
import { clean } from './activity-map-labels'

function agentState(state: NativeChatSubagentState): ActivityMapState {
  switch (state) {
    case 'working':
      return 'running'
    case 'completed':
      return 'completed'
    case 'failed':
      return 'failed'
    case 'stopped':
      return 'interrupted'
    case 'unverifiable':
      return 'unknown'
    case 'idle':
      return 'observed'
  }
}

export function activityMapChildBlocks(
  blocks: readonly NativeChatBlock[],
  base: Pick<ActivityMapEvent, 'id' | 'origin' | 'startedAt'>
): ActivityMapEvent[] {
  return blocks.flatMap((block): ActivityMapEvent[] => {
    if (block.type === 'background-task') {
      const ended =
        block.state === 'done' || block.state === 'idle' || block.state === 'unverifiable'
      return [
        {
          ...base,
          id: `task:${block.taskId}`,
          taskId: block.taskId,
          mark: 'child' as const,
          ...(block.parentToolUseId ? { callId: block.parentToolUseId } : {}),
          station:
            block.kind === 'agent' || block.kind === 'workflow'
              ? ('agents' as const)
              : ('shell' as const),
          state: !ended
            ? block.state === 'waiting' || block.state === 'blocked'
              ? ('waiting' as const)
              : ('running' as const)
            : block.error
              ? ('failed' as const)
              : ('unknown' as const),
          label: clean(block.label),
          startedAt: block.startedAt ?? base.startedAt,
          ...(block.settledAt !== undefined ? { endedAt: block.settledAt } : {}),
          ...(block.startedAt !== undefined && block.settledAt !== undefined
            ? { durationMs: Math.max(0, block.settledAt - block.startedAt) }
            : {})
        }
      ]
    }
    return namedSubagents(block).map((agent) => ({
      ...base,
      id: `agent:${agent.id}`,
      taskId: agent.id,
      mark: 'child' as const,
      station: 'agents' as const,
      state: agentState(agent.state),
      label: clean(agent.label),
      startedAt: agent.startedAt ?? base.startedAt,
      ...(agent.settledAt !== undefined ? { endedAt: agent.settledAt } : {}),
      ...(agent.startedAt !== undefined && agent.settledAt !== undefined
        ? { durationMs: Math.max(0, agent.settledAt - agent.startedAt) }
        : {})
    }))
  })
}
