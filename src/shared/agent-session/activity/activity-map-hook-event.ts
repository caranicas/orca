import { activityMapObserverOptions } from './activity-map-observer-options'
import {
  activityMapProviderClassification,
  type ActivityMapProviderOptions
} from './activity-map-provider-options'
import { activityMapModelRequestKey } from './activity-map-model-request'
import type { ActivityMapEvent } from './agent-activity-map'
import { activityMapToolDetails } from './agent-activity-map'
import { createNonSecureContextUuid } from '../../non-secure-context-uuid'
import { readActivityMapEvent } from './terminal-activity-telemetry'
import { activityMapText } from './activity-map-text'
import { activityMapTask } from './activity-map-task'

export function activityMapHookEvent(
  name: unknown,
  payload: Record<string, unknown>,
  options?: ActivityMapProviderOptions
): ActivityMapEvent | undefined {
  if (name === 'OrcaActivity') {
    const fact = readActivityMapEvent(payload.activity)
    if (!fact) {
      return undefined
    }
    const configuration = activityMapProviderClassification(options)
    const tool =
      payload.activity_tool && typeof payload.activity_tool === 'object'
        ? Object.fromEntries(Object.entries(payload.activity_tool))
        : undefined
    const records = Array.isArray(payload.activity_memory_records)
      ? payload.activity_memory_records
          .filter((id): id is string => typeof id === 'string' && /^\d{1,24}$/.test(id))
          .slice(0, 256)
      : []
    if (records.length && !options?.hookRecords) {
      return undefined
    }
    return {
      ...fact,
      ...(tool && typeof tool.name === 'string'
        ? activityMapToolDetails({ name: tool.name, input: tool.input }, configuration)
        : {}),
      ...(options?.hookReasons && typeof payload.activity_reason === 'string'
        ? { label: payload.activity_reason.split('\n')[0].slice(0, 120) }
        : {}),
      ...(records.length
        ? {
            label: activityMapText(options?.language ?? 'en').records(
              records.length,
              records
                .slice(0, 6)
                .map((id) => `#${id}`)
                .join(' ') + (records.length > 6 ? ' â€¦' : '')
            )
          }
        : {}),
      observationId: createNonSecureContextUuid()
    }
  }
  const toolId =
    typeof payload.tool_use_id === 'string'
      ? payload.tool_use_id
      : typeof payload.call_id === 'string'
        ? payload.call_id
        : undefined
  const tool =
    typeof payload.tool_name === 'string'
      ? payload.tool_name
      : typeof payload.tool === 'string'
        ? payload.tool
        : ''
  const agent = typeof payload.agent_id === 'string' && payload.agent_id.length > 0
  const origin = agent ? 'agents' : 'core'
  const event: ActivityMapEvent = {
    id: toolId ?? 'hook',
    station: 'hooks',
    origin,
    label: '',
    state: 'observed',
    startedAt: 0,
    observationId: createNonSecureContextUuid(),
    ...(agent && typeof payload.agent_id === 'string' ? { agentId: payload.agent_id } : {})
  }
  if (
    toolId &&
    tool &&
    (name === 'PreToolUse' || name === 'PostToolUse' || name === 'PostToolUseFailure')
  ) {
    const response =
      typeof payload.tool_response === 'object' && payload.tool_response !== null
        ? Object.fromEntries(Object.entries(payload.tool_response))
        : {}
    const failed =
      name === 'PostToolUseFailure' ||
      response.is_error === true ||
      response.success === false ||
      (typeof response.exit_code === 'number' && response.exit_code !== 0)
    const task = activityMapTask(response)
    return {
      ...event,
      ...activityMapToolDetails(
        { name: tool, input: payload.tool_input ?? payload.input },
        activityMapProviderClassification(options)
      ),
      state:
        name === 'PreToolUse' || (typeof task === 'string' && !failed)
          ? 'running'
          : failed
            ? 'failed'
            : 'completed',
      ...(typeof task === 'string' && /^[\w-]{1,64}$/.test(task) ? { taskId: task } : {}),
      callId: toolId
    }
  }
  if (name === 'PreCompact' || name === 'PostCompact') {
    return {
      ...event,
      id: 'compaction',
      station: 'model',
      label: name === 'PreCompact' ? 'Compaction requested' : 'Context compacted',
      state: name === 'PreCompact' ? 'observed' : 'completed',
      mark: 'compact'
    }
  }
  if (name === 'PermissionRequest' || name === 'PermissionDenied') {
    return {
      ...event,
      id: `permission:${toolId ?? tool}`,
      station: 'hooks',
      label:
        name === 'PermissionDenied' && options?.hookReasons && typeof payload.reason === 'string'
          ? payload.reason.split('\n')[0].slice(0, 72)
          : `${name === 'PermissionDenied' ? 'Blocked' : 'Permission requested'}: ${tool || 'Tool'}`,
      state: name === 'PermissionDenied' ? 'blocked' : 'waiting'
    }
  }
  if (name === 'PreModelRequest' || name === 'PostModelRequest') {
    const model = typeof payload.model === 'string' ? payload.model.slice(0, 100) : 'Model'
    const turn = typeof payload.turn_id === 'string' ? payload.turn_id : 'turn'
    return {
      ...event,
      id: `request:${turn}:${event.agentId ?? 'core'}`,
      station: 'model',
      label: model,
      state:
        name === 'PreModelRequest'
          ? 'running'
          : payload.status === 'failed'
            ? 'failed'
            : payload.status === 'cancelled'
              ? 'interrupted'
              : payload.status === 'completed' || payload.status === 'success'
                ? 'completed'
                : 'unknown',
      requestKey: activityMapModelRequestKey(turn, payload.token_usage),
      mark: 'step'
    }
  }
  if (name === 'Stop' || name === 'Interrupt' || name === 'SubagentStop') {
    return {
      ...event,
      id: typeof payload.turn_id === 'string' ? `turn:${payload.turn_id}` : `lifecycle:${name}`,
      mark: 'metadata'
    }
  }
  return undefined
}

export function activityMapPaneHookEvent(
  name: unknown,
  payload: Record<string, unknown>,
  paneKey: string
) {
  return activityMapHookEvent(name, payload, activityMapObserverOptions(paneKey))
}
