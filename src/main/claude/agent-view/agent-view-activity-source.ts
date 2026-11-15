import { parseAgentHookEndpointFile } from '../../../shared/agent-hook-listener/transport/agent-hook-endpoint-file'
import { CLAUDE_AGENT_VIEW_PATH } from '../../../shared/claude-agent-view'

// Lifecycle observation follows lot-map 09f6b93; see shared/agent-session/activity/lot-map-LICENSE.txt.
export const CLAUDE_ACTIVITY_MAP_MOD_SOURCE = String.raw`
/* Portions adapted from lot-map 09f6b93. MIT License
Copyright (c) 2026 Aleksei Volodin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
const activityEndpoint = ${parseAgentHookEndpointFile.toString()}
let activityPending = 0
let activitySerial = 0
const activityInstance = Math.random().toString(36).slice(2)

async function activityNow($) {
  try { return await $.clock.now() } catch { return undefined }
}

function activitySend($, activity, details = {}) {
  if (activityPending >= 128 || activity.startedAt === undefined) return
  activityPending++
  void (async () => {
    const session_id = await $.session.id()
    const paneKey = await $.env.get('ORCA_PANE_KEY')
    if (!paneKey) return
    let port = await $.env.get('ORCA_AGENT_HOOK_PORT')
    let token = await $.env.get('ORCA_AGENT_HOOK_TOKEN')
    let env = await $.env.get('ORCA_AGENT_HOOK_ENV')
    let version = await $.env.get('ORCA_AGENT_HOOK_VERSION')
    const endpoint = await $.env.get('ORCA_AGENT_HOOK_ENDPOINT')
    if (endpoint) {
      try { ({ port, token, env, version } = activityEndpoint(await $.fs.read(endpoint))) } catch {}
    }
    if (!token || !/^[0-9]+$/.test(String(port)) || +port < 1 || +port > 65535) return
    await $.http.fetch('http://127.0.0.1:' + port + ${JSON.stringify(CLAUDE_AGENT_VIEW_PATH)}, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-orca-agent-hook-token': token },
      body: JSON.stringify({ action: 'activity', paneKey, env, version, payload: {
        hook_event_name: 'OrcaActivity', session_id, activity: { ...activity, id: activityInstance + ':' + activity.id },
        ...details, ...(activity.agentId ? { agent_id: activity.agentId } : {})
      } })
    })
  })().catch(() => {}).finally(() => { activityPending-- })
}

function activityFact(id, station, label, state, startedAt, agentId, mark) {
  return { id, station, label, state, startedAt, origin: agentId ? 'agents' : 'core',
    ...(agentId ? { agentId } : {}), ...(mark ? { mark } : {}) }
}

async function activityContext($, model) {
  try {
    const context = (await $.session.usage()).context
    const active = model || await $.session.model()
    const now = await activityNow($)
    const known = Number.isFinite(context.percent) && Number.isFinite(context.tokens) && context.window > 0
    activitySend($, { ...activityFact('context:' + (++activitySerial), 'model', '', 'observed', now, undefined, 'metadata'),
      context: { model: active, usage: known ? {
        usedTokens: context.tokens, windowTokens: context.window, percentage: context.percent,
        estimated: false, categories: []
      } : null }
    })
  } catch {}
}

function activityInput(event) {
  const fields = ['command', 'file_path', 'notebook_path', 'path', 'pattern', 'query', 'url', 'skill', 'description', 'server', 'name', 'id']
  const selected = {}
  for (const field of fields) if (typeof event[field] === 'string') selected[field] = event[field].slice(0, 4096)
  if (typeof event.id === 'number' && Number.isFinite(event.id)) selected.id = event.id
  if (event.arguments && typeof event.arguments === 'object') selected.arguments = activityInput(event.arguments)
  return selected
}

function activityTask(result) {
  if (!result || typeof result !== 'object') return undefined
  const id = value => typeof value === 'string' && /^[\w-]{1,64}$/.test(value) ? value : undefined
  return ['async_launched', 'remote_launched'].includes(result.status)
    ? id(result.agentId) ?? id(result.taskId)
    : id(result.backgroundTaskId) ?? (typeof result.timeoutMs === 'number' ? id(result.taskId) : undefined)
}

async function noteActivityContext($, event, next, atStart) {
  const result = await next(event)
  try {
    const text = (result.additionalContext || []).join('\n')
    if (text.trim()) {
      const ids = [...new Set([...text.matchAll(/\[(?:[^\]\n]{0,12} )?#(\d{1,24})\b/g)].map(match => match[1]))].slice(0, 256)
      activitySend($, activityFact('claude-context-hook:' + (++activitySerial), 'hooks',
        atStart ? 'Context added at start' : 'Context added to message',
        'completed', await activityNow($), event.agent_id), { activity_records: ids })
      if (ids.length) activitySend($, { ...activityFact('claude-pushed-memory:' + (++activitySerial), 'memory',
        '', 'completed', await activityNow($), event.agent_id), inbound: true }, { activity_memory_records: ids })
    }
  } catch {}
  return result
}

function registerActivityMap(on) {
  const refused = new Set()
  const skills = new Map()
  const toolOwners = new Map()
  const steps = new Map()
  let contextSession
  let contextModel
  on('session.append', { door: 'response' }, async ($, event, next) => {
    const result = await next(event)
    const step = steps.get(event.agentId || 'core')
    if (step && result.uuid && step.transcriptIds.length < 64) {
      step.transcriptIds.push(result.uuid)
      activitySend($, { ...step, transcriptIds: [...step.transcriptIds] })
    }
    return result
  })
  on('turn.step', async function* ($, event, next) {
    const startedAt = await activityNow($)
    const id = 'claude-step:' + event.turnId + ':' + event.index
    const fact = { ...activityFact(id, 'model', event.model + ' · Step ' + (event.index + 1), 'running', startedAt, event.agentId, 'step'), transcriptIds: [] }
    steps.set(event.agentId || 'core', fact)
    if (!event.agentId) {
      try {
        const session = await $.session.id()
        if (contextSession !== session || contextModel !== event.model) {
          contextSession = session
          contextModel = event.model
          activitySend($, { ...activityFact('model:' + (++activitySerial), 'model', '', 'observed', startedAt, undefined, 'metadata'),
            context: { model: event.model, usage: null } })
        }
      } catch {}
    }
    activitySend($, fact)
    try {
      const result = yield* next(event)
      const endedAt = await activityNow($)
      activitySend($, { ...fact, state: result.stopReason ? 'completed' : 'unknown', endedAt,
        ...(endedAt !== undefined && startedAt !== undefined ? { durationMs: Math.max(0, endedAt - startedAt) } : {}) })
      if (!event.agentId) await activityContext($, event.model)
      return result
    } catch (error) {
      activitySend($, { ...fact, state: 'unknown', endedAt: await activityNow($) })
      throw error
    } finally {
      if (steps.get(event.agentId || 'core') === fact) steps.delete(event.agentId || 'core')
    }
  })

  on('tool.call', async ($, event, next) => {
    const startedAt = await activityNow($)
    const callId = event.tool_use_id
    if (callId) toolOwners.set(callId, { agentId: event.agentId })
    const fact = { ...activityFact('claude-tool:' + (callId || ++activitySerial), 'hooks', event.tool, 'running', startedAt, event.agentId),
      ...(callId ? { callId } : {}) }
    const details = { activity_tool: { name: event.tool, input: activityInput(event) } }
    const skill = event.tool === 'Skill' && typeof event.skill === 'string' ? event.skill : undefined
    if (skill) skills.set(skill, (skills.get(skill) || 0) + 1)
    activitySend($, fact, details)
    try {
      const result = await next(event)
      const blocked = result.deny !== undefined || (callId && refused.delete(callId))
      const taskId = blocked || result.isError ? undefined : activityTask(result.result)
      const endedAt = await activityNow($)
      activitySend($, { ...fact, state: taskId ? 'running' : blocked ? 'blocked' : result.isError ? 'failed' : 'completed',
        ...(taskId ? { taskId } : { endedAt }),
        ...(!taskId && endedAt !== undefined && startedAt !== undefined ? { durationMs: Math.max(0, endedAt - startedAt) } : {}) }, details)
      return result
    } catch (error) {
      activitySend($, { ...fact, state: error?.name === 'AbortError' ? 'interrupted' : 'failed', endedAt: await activityNow($) }, details)
      throw error
    } finally {
      if (callId) toolOwners.delete(callId)
      if (skill) {
        const remaining = (skills.get(skill) || 1) - 1
        if (remaining) skills.set(skill, remaining)
        else skills.delete(skill)
      }
    }
  })

  on('classic.PreToolUse', async ($, event, next) => {
    const startedAt = await activityNow($)
    const result = await next(event)
    const endedAt = await activityNow($)
    const denied = result.deny !== undefined
    const owner = toolOwners.get(event.tool_use_id)
    if (denied && event.tool_use_id) {
      refused.add(event.tool_use_id)
      if (refused.size > 512) refused.delete(refused.values().next().value)
    }
    if (denied || result.ask !== undefined || endedAt - startedAt >= 400) {
      activitySend($, { ...activityFact('claude-hook:' + (++activitySerial), 'hooks',
        (denied ? 'Blocked: ' : result.ask !== undefined ? 'Permission requested: ' : 'Check before: ') + event.tool,
        denied ? 'blocked' : 'completed', startedAt, owner?.agentId), endedAt,
        ...(Number.isFinite(endedAt - startedAt) ? { durationMs: endedAt - startedAt } : {}) },
        denied ? { activity_reason: String(result.deny).split('\n')[0].slice(0, 120) } : {})
    }
    return result
  })

  on('classic.UserPromptSubmit', async ($, event, next) => noteActivityContext($, event, next, false))
  on('classic.SessionStart', async ($, event, next) => noteActivityContext($, event, next, true))

  on('skill.prompt', async ($, event, next) => {
    const result = await next(event)
    if (!skills.has(event.skill)) activitySend($, activityFact('claude-skill:' + (++activitySerial), 'skills', event.skill, 'completed', await activityNow($)))
    return result
  })

  on('session.compact', async ($, event, next) => {
    const startedAt = await activityNow($)
    const fact = activityFact('claude-compact:' + (++activitySerial), 'model', 'Compacting', 'running', startedAt, event.agentId, 'compact')
    activitySend($, fact)
    try {
      const result = await next(event)
      const skipped = result.skip !== undefined || event.trigger === 'precompute'
      activitySend($, { ...fact, label: skipped ? 'Compaction not applied' : 'Context compacted',
        state: skipped ? 'observed' : 'completed', endedAt: await activityNow($) })
      if (!event.agentId && !skipped) await activityContext($)
      return result
    } catch (error) {
      activitySend($, { ...fact, state: 'failed', endedAt: await activityNow($) })
      throw error
    }
  })

  on('turn.complete', async ($, event, next) => {
    const now = await activityNow($)
    const state = event.isAborted || event.reason === 'aborted' ? 'interrupted'
      : event.reason === 'error' || event.reason === 'refusal' ? 'failed'
      : event.reason === 'answer' ? 'completed' : 'unknown'
    activitySend($, { ...activityFact('claude-turn:' + event.turnId, event.agentId ? 'agents' : 'you',
      state === 'completed' ? 'Answer ready' : state === 'interrupted' ? 'Interrupted' : state === 'failed' ? 'Turn failed' : 'Turn ended',
      state, now, event.agentId, event.agentId ? 'child' : state === 'completed' ? 'done' : undefined),
      ...(event.agentId ? { taskId: event.agentId } : {}) })
    if (!event.agentId) await activityContext($)
    return next(event)
  })
}
`.trimStart()
