// Adapted from lot-map 09f6b93, Copyright (c) 2026 Aleksei Volodin; MIT, see lot-map-LICENSE.txt.
import { classifyShell } from './activity-map-shell-classification'
import { str, isMemoryPath, lastTwo, hostOf } from './activity-map-labels'
import type {
  ActivityMapClassificationOptions as Setup,
  ActivityMapClassified as Classified
} from './activity-map-classification-options'
export function classify(
  tool: string,
  input: Record<string, unknown>,
  setup: Setup,
  fallback?: () => Classified
): Classified {
  const { t } = setup
  switch (tool) {
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'NotebookEdit': {
      const path = str(input.file_path) || str(input.notebook_path)
      return {
        station: isMemoryPath(path, setup) ? 'memory' : 'files',
        label: lastTwo(path) || tool
      }
    }
    case 'Grep':
    case 'Glob':
      return { station: 'files', label: tool }
    case 'Bash':
      return classifyShell(str(input.command), str(input.description), setup)
    case 'PowerShell':
      return classifyShell(str(input.command), str(input.description), setup, true)
    case 'WebFetch':
      return { station: 'network', label: hostOf(str(input.url)) }
    case 'WebSearch':
      return { station: 'network', label: t.webSearch }
    case 'Artifact':
      return { station: 'network', label: t.artifact }
    case 'ArtifactComments':
    case 'ArtifactData':
    case 'SendToProject':
    case 'SendToProjectContext':
      return { station: 'network', label: tool }
    case 'Agent':
      return { station: 'agents', label: str(input.description) || t.subagent }
    case 'Monitor':
      return { station: 'shell', label: str(input.description) || tool }
    case 'Workflow':
      return { station: 'agents', label: t.workflow }
    case 'SendMessage':
    case 'TaskStop':
    case 'ListAgents':
    case 'CronCreate':
    case 'CronDelete':
    case 'CronList':
    case 'ScheduleWakeup':
    case 'RemoteTrigger':
      return { station: 'agents', label: tool }
    case 'Skill':
      return { station: 'skills', label: str(input.skill) || t.skill }
    case 'ToolSearch':
      return { station: 'skills', label: t.loadingTools }
    case 'ListSkills':
    case 'SearchSkills':
    case 'SuggestSkills':
    case 'ListPlugins':
    case 'SearchPlugins':
    case 'SuggestPluginInstall':
      return { station: 'skills', label: tool }
    case 'AskUserQuestion':
      return { station: 'you', label: t.questionForYou }
    case 'SendUserFile':
      return { station: 'you', label: t.fileForYou }
    case 'TaskCreate':
    case 'TaskUpdate':
    case 'TaskList':
    case 'TaskGet':
    case 'TodoWrite':
    case 'EnterPlanMode':
    case 'ExitPlanMode':
    case 'PushNotification':
    case 'ReportFindings':
      return { station: 'you', label: tool }
  }
  const mcp = /^mcp__([^_].*?)__(.+)$/.exec(tool)
  if (mcp === null) {
    return fallback?.() ?? { station: 'shell', label: tool }
  }
  const [, server = '', name = ''] = mcp
  if (setup.memoryServers.has(server)) {
    const id =
      typeof input.id === 'number' ||
      (typeof input.id === 'string' && /^[\w-]{1,24}$/.test(input.id))
        ? ` #${input.id}`
        : ''
    return {
      station: 'memory',
      label: (setup.memoryLabels.get(name) ?? name.replace(/_+/g, ' ')) + id
    }
  }
  const remote = server === 'remote-devices' ? /^Claude_Browser__(.+)$/.exec(name) : null
  if (
    server === 'Claude_Browser' ||
    /^(?:claude-in-chrome|playwright|puppeteer|browser)$/i.test(server) ||
    remote !== null
  ) {
    const url = str(input.url)
    const action = remote?.[1] ?? name
    return {
      station: 'browser',
      label: url && /^[a-z]+:/i.test(url) ? hostOf(url) : action.replace(/_+/g, ' ')
    }
  }
  if (server === 'terminal') {
    return { station: 'shell', label: name.replace(/_+/g, ' ') }
  }
  if (server === 'visualize' || server.startsWith('ccd_')) {
    return { station: 'you', label: name.replace(/_+/g, ' ') }
  }
  if (server === 'plugin-authoring') {
    return { station: 'skills', label: name.replace(/_+/g, ' ') }
  }
  return { station: 'network', label: `${server}: ${name.replace(/_+/g, ' ')}` }
}
