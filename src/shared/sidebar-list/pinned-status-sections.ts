import type { WorkspaceStatusDefinition, Worktree } from '../worktree/types'
import { cloneDefaultWorkspaceStatuses, getWorkspaceStatus } from '../workspace-statuses'
import { PINNED_GROUP_KEY } from './group-keys'
import type { OrderedGroupEntry } from './worktree-group-entry'

export function pinnedStatusSectionKey(groupKey: string, statusId: string): string {
  return `${groupKey}:status:${encodeURIComponent(statusId)}`
}

export function buildPinnedStatusSections(
  groups: readonly { key: string; name: string; items: Worktree[] }[],
  workspaceStatuses: readonly WorkspaceStatusDefinition[]
): OrderedGroupEntry[] {
  const statuses =
    workspaceStatuses.length > 0 ? workspaceStatuses : cloneDefaultWorkspaceStatuses()
  return groups.flatMap((group): OrderedGroupEntry[] => {
    if (group.key === PINNED_GROUP_KEY) {
      return [[group.key, { label: group.name, items: group.items, repoIds: new Set() }]]
    }
    const byStatus = new Map<string, Worktree[]>()
    for (const worktree of group.items) {
      const status = getWorkspaceStatus(worktree, statuses)
      const members = byStatus.get(status) ?? []
      members.push(worktree)
      byStatus.set(status, members)
    }
    return statuses.flatMap((status): OrderedGroupEntry[] => {
      const items = byStatus.get(status.id)
      return items?.length
        ? [
            [
              pinnedStatusSectionKey(group.key, status.id),
              {
                label: status.label,
                items,
                repoIds: new Set(),
                pinnedStatus: status.id,
                pinnedParent: { key: group.key, label: group.name, items: group.items }
              }
            ]
          ]
        : []
    })
  })
}
