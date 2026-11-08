import type { ExecutionHostId } from '../execution-host'
import type { HostSectionRow } from './host-section-rows'
import { isPinnedSectionKey } from './custom-pinned-groups'

export function isHostLaneSectionKey(key: string): boolean {
  return (
    isPinnedSectionKey(key) ||
    key === 'all' ||
    key.startsWith('pr:') ||
    key.startsWith('workspace-status:')
  )
}

export function getHostSectionCollapseKey(key: string, hostId: ExecutionHostId): string {
  return hostId === 'local' || !isHostLaneSectionKey(key) ? key : `${key}:host:${hostId}`
}

export function deferHostSectionCollapse(collapsedGroups: Set<string>): Set<string> {
  if (![...collapsedGroups].some(isHostLaneSectionKey)) {
    return collapsedGroups
  }
  return new Set([...collapsedGroups].filter((key) => !isHostLaneSectionKey(key)))
}

export function scopeHostSectionCollapse(args: {
  rows: readonly HostSectionRow[]
  collapsedGroups: ReadonlySet<string>
}): HostSectionRow[] {
  let sectionCollapsed = false
  const hiddenParents = new Set<string>()
  return args.rows.flatMap((row): HostSectionRow[] => {
    if (row.type === 'host-header') {
      sectionCollapsed = false
      hiddenParents.clear()
    }
    if (row.type === 'header') {
      sectionCollapsed = false
      if (!isHostLaneSectionKey(row.key)) {
        return [row]
      }
      const hostId =
        row.hostId ??
        (row.hostWorktreeCounts?.size === 1
          ? row.hostWorktreeCounts.keys().next().value
          : undefined)
      const collapseKey = hostId ? getHostSectionCollapseKey(row.key, hostId) : row.key
      const hiddenByParent =
        row.parentGroupKey !== undefined && hiddenParents.has(row.parentGroupKey)
      sectionCollapsed = hiddenByParent || args.collapsedGroups.has(collapseKey)
      if (sectionCollapsed) {
        hiddenParents.add(row.key)
      }
      return hiddenByParent ? [] : [{ ...row, collapseKey }]
    }
    return sectionCollapsed ? [] : [row]
  })
}
