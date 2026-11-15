import type { ActivityMapStation } from './agent-activity-map'

export type ActivityMapClassified = { station: ActivityMapStation; label: string }

export type ActivityMapClassificationOptions = {
  memoryServers: ReadonlySet<string>
  memoryCommands: readonly string[]
  memorySubcommands: ReadonlySet<string>
  memoryPaths: readonly string[]
  memoryLabels: ReadonlyMap<string, string>
  t: Record<
    | 'webSearch'
    | 'artifact'
    | 'subagent'
    | 'workflow'
    | 'skill'
    | 'loadingTools'
    | 'questionForYou'
    | 'fileForYou',
    string
  >
}

export const DEFAULT_ACTIVITY_MAP_CLASSIFICATION: ActivityMapClassificationOptions = {
  memoryServers: new Set(['memory']),
  memoryCommands: [],
  memorySubcommands: new Set(),
  memoryPaths: ['/memory/', '/AGENTS.md', '/CLAUDE.md', '/MEMORY.md'],
  memoryLabels: new Map(),
  t: {
    webSearch: 'Web search',
    artifact: 'Artifact',
    subagent: 'Subagent',
    workflow: 'Workflow',
    skill: 'Skill',
    loadingTools: 'Loading tools',
    questionForYou: 'Question',
    fileForYou: 'File for you'
  }
}
