import { nativeChatToolCategory } from '../../native-chat/tools/native-chat-tool-icon'
import { mcpToolIdentity } from '../../native-chat/tools/native-chat-tool-identity'
import { normalizeToolInput, toolFilePath } from '../../native-chat/tools/native-chat-tool-summary'
import { classify } from './activity-map-tool-classification'
import { clean } from './activity-map-labels'
import {
  DEFAULT_ACTIVITY_MAP_CLASSIFICATION,
  type ActivityMapClassificationOptions
} from './activity-map-classification-options'
import type { AgentJournalToolCallItem } from '../journal/agent-session-journal-types'
import type { ActivityMapStation } from './agent-activity-map'

function shortLabel(value: string): string {
  return clean(value)
}

function shortPath(path: string): string {
  return shortLabel(path.replaceAll('\\', '/').split('/').slice(-2).join('/'))
}

type ActivityMapTool = Pick<AgentJournalToolCallItem, 'name' | 'input' | 'mcpIdentity'>

function toolStation(call: ActivityMapTool): ActivityMapStation {
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
      return 'you'
    case 'other':
    case null:
      return 'shell'
  }
}

function toolLabel(call: ActivityMapTool, station: ActivityMapStation): string {
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

export function activityMapToolDetails(
  call: ActivityMapTool,
  options: ActivityMapClassificationOptions = DEFAULT_ACTIVITY_MAP_CLASSIFICATION
) {
  const input = normalizeToolInput(call.input)
  const record: Record<string, unknown> =
    input && typeof input === 'object' && !Array.isArray(input)
      ? Object.fromEntries(Object.entries(input))
      : {}
  const name = call.name.replace(/^functions\./, '')
  if (name === 'exec' && typeof call.input === 'string') {
    return { station: 'shell' as const, label: options.t.workflow }
  }
  const shell = /^(?:exec_command|run_command|Bash|PowerShell|shell_command)$/i.test(name)
  if (shell) {
    const command =
      typeof record.cmd === 'string'
        ? record.cmd
        : typeof record.command === 'string'
          ? record.command
          : ''
    if (!command) {
      return { station: 'shell' as const, label: clean(name) }
    }
    const powershell =
      name.toLowerCase() === 'powershell' ||
      /powershell|pwsh/i.test(String(record.shell ?? '')) ||
      /\$(?:env:|[\w:]+\s*=)|\b(?:Get|Set|Invoke|Select|Remove|Copy|Move|New|Test)-[A-Za-z]/.test(
        command
      )
    const seen = classify(powershell ? 'PowerShell' : 'Bash', { ...record, command }, options)
    return { ...seen, label: clean(seen.label) }
  }
  const aliases: Record<string, string> = {
    read: 'Read',
    write: 'Write',
    edit: 'Edit',
    grep: 'Grep',
    glob: 'Glob',
    webfetch: 'WebFetch',
    websearch: 'WebSearch',
    skill: 'Skill',
    toolsearch: 'ToolSearch',
    spawn_agent: 'Agent',
    send_input: 'SendMessage',
    wait_agent: 'ListAgents',
    close_agent: 'TaskStop',
    resume_agent: 'Agent',
    update_plan: 'TodoWrite',
    request_user_input: 'AskUserQuestion'
  }
  const mcp =
    call.mcpIdentity ??
    (() => {
      const match = /^mcp__([^\s]+?)__(\S+)$/.exec(call.name)
      return match ? { server: match[1], tool: match[2] } : null
    })()
  const argumentsRecord =
    mcp &&
    record.arguments &&
    typeof record.arguments === 'object' &&
    !Array.isArray(record.arguments)
      ? Object.fromEntries(Object.entries(record.arguments))
      : {}
  const seen = classify(
    mcp ? `mcp__${mcp.server}__${mcp.tool}` : (aliases[name.toLowerCase()] ?? name),
    {
      ...record,
      ...argumentsRecord,
      file_path: toolFilePath(call.input) ?? argumentsRecord.file_path ?? record.file_path
    },
    options,
    () => {
      const station = toolStation(call)
      return { station, label: toolLabel(call, station) }
    }
  )
  const path = toolFilePath(call.input)
  return path && /(?:^|\/)SKILL\.md$/i.test(path.replaceAll('\\', '/'))
    ? { station: 'skills' as const, label: shortPath(path) }
    : { ...seen, label: clean(seen.label) }
}
