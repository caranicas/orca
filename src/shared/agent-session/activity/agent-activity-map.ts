import { agentJournalToolCallLifecycle } from '../../agent-journal-tool-call-lifecycle'
import { nativeChatToolCategory } from '../../native-chat/tools/native-chat-tool-icon'
import { mcpToolIdentity } from '../../native-chat/tools/native-chat-tool-identity'
import { normalizeToolInput, toolFilePath } from '../../native-chat/tools/native-chat-tool-summary'
import { compareAgentJournalItems } from '../journal/agent-session-journal-position'
import { isRootAgentJournalItem } from '../journal/agent-session-journal-producer'
import type {
  AgentJournalRenderItem,
  AgentJournalToolCallItem
} from '../journal/agent-session-journal-types'

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
  | 'tools'

export type ActivityMapState =
  | 'running'
  | 'completed'
  | 'failed'
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
}

function shortLabel(value: string): string {
  return value
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .trim()
    .slice(0, 80)
}

function shortPath(path: string): string {
  return shortLabel(path.replaceAll('\\', '/').split('/').slice(-2).join('/'))
}

function toolStation(call: AgentJournalToolCallItem): ActivityMapStation {
  const name = call.name.trim().toLowerCase()
  const path = toolFilePath(call.input)?.replaceAll('\\', '/')
  if (name === 'skill' || name === 'toolsearch' || /(?:^|\/)SKILL\.md$/i.test(path ?? '')) {
    return 'skills'
  }
  if (/(?:^|\/)(?:AGENTS|CLAUDE|MEMORY)\.md$|(?:^|\/)memory\//i.test(path ?? '')) {
    return 'memory'
  }
  if (/^(?:spawn_agent|send_input|wait_agent|close_agent|resume_agent)$/.test(name)) {
    return 'agents'
  }
  const mcp = mcpToolIdentity(call.name, call.mcpIdentity)
  if (mcp) {
    if (/\bmemory\b/i.test(mcp.server)) {
      return 'memory'
    }
    if (/\b(?:browser|playwright|puppeteer)\b/i.test(mcp.server)) {
      return 'browser'
    }
    return 'network'
  }
  switch (nativeChatToolCategory(call.name, call.mcpIdentity, call.input)) {
    case 'read':
    case 'search':
    case 'listFiles':
    case 'fileChange':
      return 'files'
    case 'unknown':
      return 'shell'
    case 'browser':
      return 'browser'
    case 'webSearch':
      return 'network'
    case 'subAgentActivity':
      return 'agents'
    case 'mcpToolCall':
      return 'network'
    case 'todoList':
    case 'other':
    case null:
      return 'tools'
  }
}

function toolLabel(call: AgentJournalToolCallItem, station: ActivityMapStation): string {
  const path = toolFilePath(call.input)
  if (path && (station === 'files' || station === 'memory' || station === 'skills')) {
    return shortPath(path)
  }
  const mcp = mcpToolIdentity(call.name, call.mcpIdentity)
  if (mcp) {
    return shortLabel(`${mcp.server} / ${mcp.tool}`)
  }
  // Codex's classified shell rows sometimes name the entire command; keep only the tool word.
  const name = shortLabel(call.name).split(/\s/)[0] || 'Tool'
  const input = normalizeToolInput(call.input)
  if (station === 'network' && input && typeof input === 'object' && 'url' in input) {
    try {
      const url = new URL(String(input.url))
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return shortLabel(url.hostname)
      }
    } catch {
      return name
    }
  }
  return name
}

function projectItem(item: AgentJournalRenderItem): ActivityMapEvent | null {
  const body = item.body
  const event: ActivityMapEvent = {
    id: item.itemId,
    station: 'tools',
    origin: !isRootAgentJournalItem(item) && item.producerKind !== 'background' ? 'agents' : 'core',
    state: 'observed',
    label: '',
    startedAt: item.observedAt
  }
  if (body.kind === 'tool-call') {
    const station = toolStation(body)
    return {
      ...event,
      station,
      state:
        body.endedAs === 'unverifiable'
          ? 'unknown'
          : (agentJournalToolCallLifecycle(body) ?? 'unknown'),
      label: toolLabel(body, station),
      ...(body.durationMs !== undefined ? { durationMs: body.durationMs } : {})
    }
  }
  if (body.kind === 'diff') {
    return { ...event, station: 'files', label: shortPath(body.path) }
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
    return { ...event, station: 'model', label: 'Reasoning', state: body.state ?? 'observed' }
  }
  if (body.role === 'user') {
    return { ...event, station: body.from ? 'agents' : 'you', label: 'Message' }
  }
  return null
}

/** Project the loaded journal, including revised calls, without retaining arguments or output. */
export function projectAgentActivityMap(
  items: readonly AgentJournalRenderItem[]
): ActivityMapEvent[] {
  return [...items].sort(compareAgentJournalItems).flatMap((item) => {
    const event = projectItem(item)
    return event ? [event] : []
  })
}
