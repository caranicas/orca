import { isPinnedSectionKey } from '../../../../../../shared/sidebar-list/custom-pinned-groups'
import type { HostSectionRow } from '../../../../../../shared/sidebar-list/hosts/host-section-rows'
import type { RenderRow } from './render-row'

export type WorktreeItemRow = Extract<HostSectionRow, { type: 'item' }>
export type FolderWorkspaceItemRow = Extract<HostSectionRow, { type: 'folder-workspace' }>

export function isWorktreeItemRow(row: HostSectionRow): row is WorktreeItemRow {
  return row.type === 'item'
}

export function isPinnedWorktreeRow(row: WorktreeItemRow): boolean {
  return isPinnedSectionKey(row.sectionKey)
}

// Each visible workspace owns a measured virtual slot, including expanded descendants.
export function buildRenderableRows(rows: HostSectionRow[]): RenderRow[] {
  return rows
}
