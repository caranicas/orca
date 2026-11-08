import type { WorktreeOccurrencePlan } from '../worktree-occurrence-plan'
import type { Worktree } from '../worktree/types'
import type { ExecutionHostId } from '../execution-host'
import { buildPinnedGroupHeader, type PinnedSectionHeader } from './pinned-group-header'
import { PINNED_GROUP_KEY } from './group-keys'
import { appendWorktreeRows } from './row-builders'
import type { RepoOfWorktree, Row } from './row-types'

export function emitPinnedGroup(
  pinnedSectionWorktrees: Worktree[],
  repoOf: RepoOfWorktree,
  defaultHostId: ExecutionHostId,
  collapsedGroups: Set<string>,
  result: Row[],
  occurrencePlan: WorktreeOccurrencePlan<Worktree>,
  hostContextLabelByWorktreeIdentity?: ReadonlyMap<string, string>,
  section: PinnedSectionHeader = { key: PINNED_GROUP_KEY, label: '' }
): void {
  if (pinnedSectionWorktrees.length === 0) {
    return
  }
  result.push(buildPinnedGroupHeader(pinnedSectionWorktrees, repoOf, defaultHostId, section))
  if (collapsedGroups.has(section.key)) {
    return
  }
  appendWorktreeRows(result, repoOf, occurrencePlan, {
    collapsedGroups,
    groupDepth: section.groupDepth ?? 0,
    sectionKey: section.key,
    hostContextLabelByWorktreeIdentity
  })
}
