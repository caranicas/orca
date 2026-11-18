import type { ActivityMapEvent } from '../../shared/agent-session/activity/agent-activity-map'
import { asRecord, extractString } from '../ai-vault/session-scanner-values'

export function createProviderHookActivity() {
  const active = new Map<string, ActivityMapEvent>()
  return (
    provider: 'codex' | 'claude',
    method: string,
    payload: unknown,
    at: number
  ): ActivityMapEvent | null => {
    const row = asRecord(payload)
    const run = provider === 'codex' ? asRecord(row?.run) : row
    const id = extractString(provider === 'codex' ? run?.id : run?.hook_id)
    if (!id || !run) {
      return null
    }
    const started = provider === 'codex' ? method === 'hook/started' : method === 'hook_started'
    const completed =
      provider === 'codex' ? method === 'hook/completed' : method === 'hook_response'
    if (!started && !completed) {
      return null
    }
    const key = `${provider}:hook:${id}`
    const before = active.get(key)
    if (started && before && before.state !== 'running') {
      return null
    }
    const status = provider === 'codex' ? run.status : run.outcome
    const state = started
      ? 'running'
      : status === 'failed' || status === 'error'
        ? 'failed'
        : status === 'blocked'
          ? 'blocked'
          : status === 'stopped' || status === 'cancelled'
            ? 'interrupted'
            : status === 'completed' || status === 'success'
              ? 'completed'
              : 'unknown'
    const reportedStart =
      typeof run.startedAt === 'number' && run.startedAt > 0 ? run.startedAt : undefined
    const reportedEnd =
      typeof run.completedAt === 'number' && run.completedAt > 0 ? run.completedAt : undefined
    const duration =
      typeof run.durationMs === 'number' && run.durationMs >= 0 ? run.durationMs : undefined
    const event: ActivityMapEvent = {
      id: key,
      station: 'hooks',
      origin: 'core',
      state,
      label: extractString(run.eventName ?? run.hook_event ?? run.hook_name) ?? 'Hook',
      startedAt: reportedStart ?? before?.startedAt ?? at,
      ...(completed ? { endedAt: reportedEnd ?? at } : {}),
      ...(duration !== undefined
        ? { durationMs: duration }
        : completed && before
          ? { durationMs: Math.max(0, at - before.startedAt), durationEstimated: true }
          : {})
    }
    active.set(key, event)
    if (active.size > 512) {
      const settled = [...active].find(([, item]) => item.state !== 'running')
      if (settled) {
        active.delete(settled[0])
      }
    }
    return event
  }
}
