import type { Worktree } from '../worktree/types'
import { getWorktreeHostIdentity } from '../worktree/host-qualified-identity'
import { PINNED_GROUP_KEY } from './group-keys'

export type PinnedWorkspaceGroup = { id: string; name: string }
export type PinnedWorkspaceGrouping = {
  groups: readonly PinnedWorkspaceGroup[]
  memberships: Readonly<Record<string, string>>
}

const CUSTOM_PINNED_PREFIX = 'pinned-custom:'

export function isPinnedSectionKey(key: string): boolean {
  return key === PINNED_GROUP_KEY || key.startsWith(CUSTOM_PINNED_PREFIX)
}

export function customPinnedGroupKey(id: string): string {
  return `${CUSTOM_PINNED_PREFIX}${id}`
}

export function hasCustomPinnedGroup(
  worktree: Worktree,
  grouping?: PinnedWorkspaceGrouping
): boolean {
  const id = grouping?.memberships[getWorktreeHostIdentity(worktree)]
  return id !== undefined && grouping?.groups.some((group) => group.id === id) === true
}

export function partitionPinnedWorkspaces(
  worktrees: Worktree[],
  grouping: PinnedWorkspaceGrouping | undefined,
  childrenByParent: ReadonlyMap<string, readonly Worktree[]>
): { key: string; name: string; items: Worktree[] }[] {
  const sections: { key: string; name: string; items: Worktree[] }[] = [
    { key: PINNED_GROUP_KEY, name: '', items: [] },
    ...(grouping?.groups ?? []).map((group) => ({
      key: customPinnedGroupKey(group.id),
      name: group.name,
      items: []
    }))
  ]
  const byId = new Map(
    (grouping?.groups ?? []).map((group, index) => [group.id, sections[index + 1]])
  )
  const parentByChild = new Map<string, string>()
  for (const [parent, children] of childrenByParent) {
    for (const child of children) {
      parentByChild.set(getWorktreeHostIdentity(child), parent)
    }
  }
  for (const worktree of worktrees) {
    let identity: string | undefined = getWorktreeHostIdentity(worktree)
    const seen = new Set<string>()
    let section: (typeof sections)[number] | undefined
    while (identity !== undefined && !seen.has(identity)) {
      seen.add(identity)
      const id: string | undefined = grouping?.memberships[identity]
      if (id !== undefined && byId.has(id)) {
        section = byId.get(id)
        break
      }
      identity = parentByChild.get(identity)
    }
    const target = section ?? sections[0]
    target?.items.push(worktree)
  }
  return sections.filter((section) => section.items.length > 0)
}
