import type { Worktree } from '../worktree/types'
import { getWorktreeExecutionHostId, type ExecutionHostId } from '../execution-host'
import type { GroupHeaderRow, RepoOfWorktree, SidebarHeaderIcon } from './row-types'

export type PinnedSectionHeader = {
  key: string
  label: string
  icon?: SidebarHeaderIcon
  parentGroupKey?: string
  groupDepth?: number
}

export function buildPinnedGroupHeader(
  worktrees: readonly Worktree[],
  repoOf: RepoOfWorktree,
  defaultHostId: ExecutionHostId,
  section: PinnedSectionHeader
): GroupHeaderRow {
  const hostWorktreeCounts = new Map<ExecutionHostId, number>()
  const hostWorktreeIds = new Map<ExecutionHostId, string[]>()
  for (const worktree of worktrees) {
    const hostId = getWorktreeExecutionHostId(worktree, repoOf(worktree), defaultHostId)
    hostWorktreeCounts.set(hostId, (hostWorktreeCounts.get(hostId) ?? 0) + 1)
    const ids = hostWorktreeIds.get(hostId) ?? []
    ids.push(worktree.id)
    hostWorktreeIds.set(hostId, ids)
  }
  return {
    type: 'header',
    key: section.key,
    ...(section.label ? { label: section.label } : {}),
    icon: section.icon ?? { kind: 'pinned' },
    count: worktrees.length,
    ...(section.parentGroupKey ? { parentGroupKey: section.parentGroupKey } : {}),
    ...(section.groupDepth ? { groupDepth: section.groupDepth } : {}),
    hostWorktreeCounts,
    hostWorktreeIds,
    worktreeIds: worktrees.map((worktree) => worktree.id)
  }
}
