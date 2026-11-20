import type { ActivityMapClassificationOptions } from '../../shared/agent-session/activity/activity-map-classification-options'
import { asRecord } from '../ai-vault/parsing/session-record-fields'
import { extractString } from '../../shared/text/trimmed-string'
import {
  activityMapToolDetails,
  type ActivityMapEvent,
  type ActivityMapState
} from '../../shared/agent-session/activity/agent-activity-map'
import { clean, lastTwo } from '../../shared/agent-session/activity/activity-map-labels'

export function codexCompletedActivityItem(
  payload: Record<string, unknown>,
  base: ActivityMapEvent,
  options?: ActivityMapClassificationOptions
): ActivityMapEvent | null {
  const item = asRecord(payload.item)
  if (!item) {
    return null
  }
  const started =
    typeof payload.started_at_ms === 'number' && Number.isFinite(payload.started_at_ms)
      ? payload.started_at_ms
      : null
  const ended =
    typeof payload.completed_at_ms === 'number' && Number.isFinite(payload.completed_at_ms)
      ? payload.completed_at_ms
      : base.startedAt
  const span = asRecord(item.duration)
  const duration =
    span && typeof span.secs === 'number' && typeof span.nanos === 'number'
      ? span.secs * 1000 + span.nanos / 1_000_000
      : started !== null
        ? Math.max(0, ended - started)
        : null
  const state: ActivityMapState =
    item.status === 'declined'
      ? 'blocked'
      : item.status === 'failed' ||
          item.success === false ||
          (typeof item.exit_code === 'number' && item.exit_code !== 0) ||
          asRecord(item.result)?.isError === true
        ? 'failed'
        : item.status === 'interrupted' || item.status === 'cancelled'
          ? 'interrupted'
          : item.status === 'in_progress' || item.status === 'inProgress'
            ? 'running'
            : 'completed'
  const event: ActivityMapEvent = {
    ...base,
    id: `item:${extractString(item.id) ?? base.id}`,
    ...(extractString(item.id) ? { callId: extractString(item.id)! } : {}),
    state,
    startedAt: started ?? base.startedAt,
    endedAt: ended,
    ...(duration !== null ? { durationMs: duration } : {})
  }
  delete event.mark
  if (item.type === 'CommandExecution') {
    const words = Array.isArray(item.command)
      ? item.command.filter((word): word is string => typeof word === 'string')
      : []
    const shell = words[0] ?? ''
    const isShell = /(?:^|[/\\])(?:powershell|pwsh|bash|zsh|sh|cmd)(?:\.exe)?$/i.test(shell)
    const scriptAt = isShell
      ? words.findIndex((word) => /^(?:-c|-lc|-command|\/c)$/i.test(word))
      : -1
    const command = scriptAt > 0 ? words.slice(scriptAt + 1).join(' ') : words.join(' ')
    return {
      ...event,
      ...activityMapToolDetails(
        {
          name: /powershell|pwsh/i.test(shell) ? 'PowerShell' : 'Bash',
          input: { command }
        },
        options
      )
    }
  }
  if (item.type === 'DynamicToolCall' || item.type === 'CollabAgentToolCall') {
    return {
      ...event,
      ...activityMapToolDetails(
        { name: extractString(item.tool) ?? 'Tool', input: item.arguments },
        options
      )
    }
  }
  if (item.type === 'SubAgentActivity') {
    return {
      ...event,
      state: 'observed',
      mark: 'child',
      callId: undefined,
      station: 'agents',
      label: clean(extractString(item.agent_path) ?? 'Subagent'),
      ...(extractString(item.agent_thread_id)
        ? { taskId: extractString(item.agent_thread_id)! }
        : {})
    }
  }
  if (item.type === 'McpToolCall') {
    const server = extractString(item.server) ?? 'mcp'
    const tool = extractString(item.tool) ?? 'tool'
    return {
      ...event,
      ...activityMapToolDetails(
        {
          name: `mcp__${server}__${tool}`,
          input: item.arguments,
          mcpIdentity: { server, tool }
        },
        options
      )
    }
  }
  if (item.type === 'FileChange') {
    const paths = Object.keys(asRecord(item.changes) ?? {})
    return {
      ...event,
      station: 'files',
      label: clean(
        paths.length
          ? `${lastTwo(paths[0])}${paths.length > 1 ? ` +${paths.length - 1}` : ''}`
          : 'File change'
      )
    }
  }
  if (item.type === 'HookPrompt') {
    return { ...event, station: 'hooks', label: 'Hook context' }
  }
  if (item.type === 'WebSearch' || (item.type === 'Extension' && item.kind === 'web_search')) {
    const action = asRecord(item.action)
    const url = extractString(action?.url)
    return {
      ...event,
      ...activityMapToolDetails({ name: url ? 'WebFetch' : 'WebSearch', input: { url } }, options)
    }
  }
  if (item.type === 'ImageView') {
    const path = typeof item.path === 'string' ? item.path : ''
    return { ...event, station: 'files', label: path ? clean(lastTwo(path)) : 'Image' }
  }
  return null
}
