import type { ActivityMapEvent } from '../../shared/agent-session/activity/agent-activity-map'
import { claudeRecord, claudeText } from './structured/journal/claude-structured-item-translation'

export function createClaudeModelActivity() {
  const active = new Map<string, ActivityMapEvent>()
  function observe(frame: Record<string, unknown>, at: number): ActivityMapEvent | null {
    const streamed = frame.type === 'stream_event' ? claudeRecord(frame.event) : null
    const message =
      streamed?.type === 'message_start'
        ? claudeRecord(streamed.message)
        : frame.type === 'assistant'
          ? claudeRecord(frame.message)
          : null
    const id = claudeText(message?.id)
    const model = claudeText(message?.model)
    if (!id || !model || model === '<synthetic>' || !claudeRecord(message?.usage)) {
      return null
    }
    const previous = active.get(id)
    const running = streamed?.type === 'message_start'
    if (running && previous && previous.state !== 'running') {
      return null
    }
    const event: ActivityMapEvent = {
      id: `claude-response:${id}`,
      station: 'model',
      origin: frame.parent_tool_use_id ? 'agents' : 'core',
      state: running ? 'running' : 'completed',
      mark: 'step',
      label: model,
      startedAt: previous?.startedAt ?? at,
      ...(!running ? { endedAt: at } : {}),
      ...(!running && previous ? { durationMs: Math.max(0, at - previous.startedAt) } : {}),
      ...(claudeText(frame.uuid) ? { transcriptIds: [String(frame.uuid)] } : {}),
      ...(claudeText(frame.parent_tool_use_id) ? { agentId: String(frame.parent_tool_use_id) } : {})
    }
    active.set(id, event)
    if (active.size > 256) {
      const settled = [...active].find(([, item]) => item.state !== 'running')
      if (settled) {
        active.delete(settled[0])
      }
    }
    return event
  }
  return {
    observe,
    settle(at: number, rootOnly = false): ActivityMapEvent[] {
      const settled: ActivityMapEvent[] = []
      for (const [id, event] of active) {
        if (event.state !== 'running' || (rootOnly && event.origin !== 'core')) {
          continue
        }
        const next: ActivityMapEvent = { ...event, state: 'unknown', endedAt: at }
        active.set(id, next)
        settled.push(next)
      }
      return settled
    }
  }
}
