import type { ExecutionHostId, ExecutionHostScope } from '../execution-host'
import type { ProjectOrderBy } from '../ui-chrome-types'
import type { WorkspaceRowFilters } from '../workspace-view/workspace-row-filters'
import type { WorkspaceStatusDefinition } from '../worktree/types'
import type { PinnedWorkspaceGrouping } from './custom-pinned-groups'
import type { PinnedWorktreeDisplayPolicy, WorktreeGroupBy } from './row-types'
import type { SortBy } from './smart-sort'

export type SidebarFeedView = {
  pinnedWorkspaceGrouping?: PinnedWorkspaceGrouping
  groupBy: WorktreeGroupBy
  sortBy: SortBy
  projectOrderBy: ProjectOrderBy
  collapsedGroups: ReadonlySet<string>
  filters: WorkspaceRowFilters
  workspaceHostScope: ExecutionHostScope
  visibleWorkspaceHostIds: readonly ExecutionHostId[] | null
  workspaceStatuses: readonly WorkspaceStatusDefinition[]
  pinnedDisplayPolicy: PinnedWorktreeDisplayPolicy
  defaultHostId: ExecutionHostId
  hostLabelOverrides: ReadonlyMap<ExecutionHostId, string>
  localHostLabel: string
  workspaceHostOrder?: readonly ExecutionHostId[]
}
