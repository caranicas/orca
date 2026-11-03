import type { FolderWorkspace } from '../folder-workspace-types'
import type { ProjectGroup } from '../project-group-types'
import type { Repo } from '../repo-types'
import type { ProjectOrderBy } from '../ui-chrome-types'
import type { WorktreeLineage } from '../worktree/lineage-types'
import type { WorkspaceStatusDefinition, Worktree } from '../worktree/types'
import type { ExecutionHostId } from '../execution-host'
import type { ProjectSectionModel } from '../project-section-grouping'
import type { PinnedWorkspaceGrouping } from './custom-pinned-groups'
import type {
  ImportedWorktreesCardCandidate,
  NewExternalWorktreesInboxCandidate,
  PendingCreationRef,
  PinnedWorktreeDisplayPolicy,
  RepoOfWorktree,
  SidebarPRGroupReader,
  WorktreeGroupBy
} from './row-types'

/** Pure inputs shared by the desktop and remote sidebar planners. */
export type SidebarRowPlanInputs = {
  pinnedWorkspaceGrouping?: PinnedWorkspaceGrouping
  groupBy: WorktreeGroupBy
  worktrees: Worktree[]
  repoMap: Map<string, Repo>
  repoOfWorktree?: RepoOfWorktree
  prGroupOf: SidebarPRGroupReader
  repoOrder?: Map<string, number>
  workspaceStatuses: readonly WorkspaceStatusDefinition[]
  projectOrderBy: ProjectOrderBy
  lineageById: Record<string, WorktreeLineage>
  worktreeMap: Map<string, Worktree>
  nestLineage: boolean
  projectGroups: readonly ProjectGroup[]
  placeholderRepoIds: ReadonlySet<string>
  importedWorktreesByRepo: ReadonlyMap<string, ImportedWorktreesCardCandidate>
  newExternalWorktreesInboxByRepo: ReadonlyMap<string, NewExternalWorktreesInboxCandidate>
  pendingCreations: readonly PendingCreationRef[]
  projectGrouping?: ProjectSectionModel
  folderWorkspaces: readonly FolderWorkspace[]
  hostLabelById?: ReadonlyMap<string, string>
  defaultHostId: ExecutionHostId
  pinnedDisplayPolicy: PinnedWorktreeDisplayPolicy
  filterRepoIds: readonly string[]
}
