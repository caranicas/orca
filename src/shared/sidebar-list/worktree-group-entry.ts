import type { ProjectSectionEntry } from '../project-section-grouping'
import type { Worktree } from '../worktree/types'
import type { RenderableFolderWorkspace } from './folder-workspace-lanes'

export type OrderedGroupEntry = [string, WorktreeGroupEntry]

export type WorktreeGroupEntry = ProjectSectionEntry<Worktree> & {
  pinnedParent?: { key: string; label: string; items: Worktree[] }
  pinnedStatus?: string
  /** Folder rows need their owning group even outside repo grouping. */
  folderWorkspaces?: RenderableFolderWorkspace[]
}
