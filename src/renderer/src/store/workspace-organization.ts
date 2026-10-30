import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type {
  PinnedWorkspaceGroup,
  PinnedWorkspaceGrouping
} from '../../../shared/sidebar-list/custom-pinned-groups'
import { normalizeRepoBadgeColor } from '../../../shared/repo-badge-color'

type SavedOrganization = {
  grouping: PinnedWorkspaceGrouping
  colors: Record<string, string>
}

type WorkspaceOrganization = SavedOrganization & {
  managerOpen: boolean
  setManagerOpen: (open: boolean) => void
  saveGroups: (groups: readonly PinnedWorkspaceGroup[]) => void
  assignGroup: (identities: readonly string[], groupId: string | null) => void
  setColor: (identities: readonly string[], color: string | null) => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizeWorkspaceOrganization(value: unknown): SavedOrganization {
  const saved = isRecord(value) ? value : {}
  const grouping = isRecord(saved.grouping) ? saved.grouping : {}
  const groups: PinnedWorkspaceGroup[] = []
  for (const group of Array.isArray(grouping.groups) ? grouping.groups : []) {
    if (
      isRecord(group) &&
      typeof group.id === 'string' &&
      typeof group.name === 'string' &&
      group.id.length > 0 &&
      group.id.length <= 100 &&
      group.name.trim() &&
      !groups.some((entry) => entry.id === group.id)
    ) {
      groups.push({ id: group.id, name: group.name.trim().slice(0, 80) })
    }
  }
  const ids = new Set(groups.map((group) => group.id))
  const memberships = Object.fromEntries(
    Object.entries(isRecord(grouping.memberships) ? grouping.memberships : {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string' && ids.has(entry[1])
    )
  )
  const colors: Record<string, string> = {}
  for (const [identity, color] of Object.entries(isRecord(saved.colors) ? saved.colors : {})) {
    const normalized = normalizeRepoBadgeColor(color)
    if (normalized) {
      Object.defineProperty(colors, identity, {
        value: normalized,
        enumerable: true,
        configurable: true,
        writable: true
      })
    }
  }
  return { grouping: { groups, memberships }, colors }
}

export const useWorkspaceOrganization = create<WorkspaceOrganization>()(
  persist(
    (set) => ({
      grouping: { groups: [], memberships: {} },
      colors: {},
      managerOpen: false,
      setManagerOpen: (managerOpen) => set({ managerOpen }),
      saveGroups: (groups) =>
        set((state) =>
          normalizeWorkspaceOrganization({ ...state, grouping: { ...state.grouping, groups } })
        ),
      assignGroup: (identities, groupId) =>
        set((state) => {
          if (groupId !== null && !state.grouping.groups.some((group) => group.id === groupId)) {
            return state
          }
          const memberships = { ...state.grouping.memberships }
          for (const identity of identities) {
            if (groupId === null) {
              delete memberships[identity]
            } else {
              Object.defineProperty(memberships, identity, {
                value: groupId,
                enumerable: true,
                configurable: true,
                writable: true
              })
            }
          }
          return { grouping: { ...state.grouping, memberships } }
        }),
      setColor: (identities, color) =>
        set((state) => {
          const colors = { ...state.colors }
          const normalized = normalizeRepoBadgeColor(color)
          for (const identity of identities) {
            if (normalized === null) {
              delete colors[identity]
            } else {
              Object.defineProperty(colors, identity, {
                value: normalized,
                enumerable: true,
                configurable: true,
                writable: true
              })
            }
          }
          return { colors }
        })
    }),
    {
      name: 'orca.workspace-organization.v1',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ grouping, colors }) => ({ grouping, colors }),
      merge: (saved, current) => ({ ...current, ...normalizeWorkspaceOrganization(saved) })
    }
  )
)
