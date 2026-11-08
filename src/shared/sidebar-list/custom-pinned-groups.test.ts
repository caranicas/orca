import { pinnedStatusSectionKey } from './pinned-status-sections'
import { describe, expect, it } from 'vitest'
import type { Worktree } from '../worktree/types'
import { getWorktreeHostIdentity } from '../worktree/host-qualified-identity'
import { cloneDefaultWorkspaceStatuses } from '../workspace-statuses'
import { planSidebarRows, type SidebarRowPlanInputs } from './sidebar-row-plan'
import { customPinnedGroupKey, type PinnedWorkspaceGrouping } from './custom-pinned-groups'
import { getHostSectionCollapseKey, scopeHostSectionCollapse } from './host-section-collapse'

function workspace(id: string, overrides: Partial<Worktree> = {}): Worktree {
  return {
    id,
    repoId: 'repo',
    path: `/${id}`,
    head: 'abc',
    branch: id,
    isBare: false,
    isMainWorktree: false,
    displayName: id,
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 0,
    hostId: 'local',
    ...overrides
  }
}

function plan(
  worktrees: Worktree[],
  grouping: PinnedWorkspaceGrouping,
  overrides: Partial<SidebarRowPlanInputs> = {}
) {
  return planSidebarRows({
    groupBy: 'none',
    sortBy: 'manual',
    worktrees,
    repoMap: new Map([
      ['repo', { id: 'repo', path: '/repo', displayName: 'Repo', badgeColor: '', addedAt: 0 }]
    ]),
    prGroupOf: () => 'in-progress',
    workspaceStatuses: cloneDefaultWorkspaceStatuses(),
    projectOrderBy: 'manual',
    lineageById: {},
    worktreeMap: new Map(worktrees.map((row) => [row.id, row])),
    nestLineage: false,
    projectGroups: [],
    placeholderRepoIds: new Set(),
    importedWorktreesByRepo: new Map(),
    newExternalWorktreesInboxByRepo: new Map(),
    pendingCreations: [],
    folderWorkspaces: [],
    defaultHostId: 'local',
    pinnedDisplayPolicy: 'single-location',
    filterRepoIds: [],
    pinnedWorkspaceGrouping: grouping,
    ...overrides
  })
}

const groups = [
  { id: 'migration', name: 'Migrations' },
  { id: 'accessibility', name: 'Accessibility' }
]

describe('custom pinned workspace sections', () => {
  it('renders status subheadings in the configured order and preserves the order within a status', () => {
    const rows = [
      workspace('done', { workspaceStatus: 'completed' }),
      workspace('review-1', { workspaceStatus: 'in-review' }),
      workspace('todo', { workspaceStatus: 'todo' }),
      workspace('review-2', { workspaceStatus: 'in-review' })
    ]
    const memberships = Object.fromEntries(
      rows.map((row) => [getWorktreeHostIdentity(row), 'migration'])
    )
    const statuses = cloneDefaultWorkspaceStatuses().toReversed()
    const built = plan(rows, { groups, memberships }, { workspaceStatuses: statuses })
    const result = built.render(new Set())
    expect(
      result.filter((row) => row.type === 'header').map((row) => [row.label, row.count])
    ).toEqual([
      ['Migrations', 4],
      ['Done', 1],
      ['In review', 2],
      ['Todo', 1]
    ])
    expect(result.filter((row) => row.type === 'item').map((row) => row.worktree.id)).toEqual([
      'done',
      'review-1',
      'review-2',
      'todo'
    ])
    const reviewKey = pinnedStatusSectionKey(customPinnedGroupKey('migration'), 'in-review')
    expect(
      built
        .render(new Set([reviewKey]))
        .filter((row) => row.type === 'item')
        .map((row) => row.worktree.id)
    ).toEqual(['done', 'todo'])
  })

  it('moves a workspace into its new status subsection after its status changes', () => {
    const row = workspace('changing', { workspaceStatus: 'todo' })
    const grouping = { groups, memberships: { [getWorktreeHostIdentity(row)]: 'migration' } }
    const before = plan([row], grouping).render(new Set())
    const after = plan([{ ...row, workspaceStatus: 'completed' }], grouping).render(new Set())
    expect(before.filter((entry) => entry.type === 'header').map((entry) => entry.label)).toEqual([
      'Migrations',
      'Todo'
    ])
    expect(after.filter((entry) => entry.type === 'header').map((entry) => entry.label)).toEqual([
      'Migrations',
      'Done'
    ])
  })

  it('keeps nested child workspaces with their assigned parent group', () => {
    const parent = workspace('parent', { instanceId: 'parent-instance' })
    const child = workspace('child', { instanceId: 'child-instance' })
    const result = plan(
      [child, parent],
      { groups, memberships: { [getWorktreeHostIdentity(parent)]: 'migration' } },
      {
        nestLineage: true,
        lineageById: {
          child: {
            worktreeId: 'child',
            worktreeInstanceId: 'child-instance',
            parentWorktreeId: 'parent',
            parentWorktreeInstanceId: 'parent-instance',
            origin: 'manual',
            capture: { source: 'manual-action', confidence: 'explicit' },
            createdAt: 1
          }
        }
      }
    ).render(new Set())
    expect(
      result
        .filter((row) => row.type === 'item')
        .map((row) => [row.worktree.id, row.sectionKey, row.depth])
    ).toEqual([
      ['parent', pinnedStatusSectionKey(customPinnedGroupKey('migration'), 'in-progress'), 0],
      ['child', pinnedStatusSectionKey(customPinnedGroupKey('migration'), 'in-progress'), 1]
    ])
  })

  it('respects the preference to show pinned workspaces in natural groups too', () => {
    const row = workspace('duplicate')
    const result = plan(
      [row],
      { groups, memberships: { [getWorktreeHostIdentity(row)]: 'migration' } },
      { pinnedDisplayPolicy: 'duplicate-in-groups' }
    ).render(new Set())
    expect(
      result.filter((entry) => entry.type === 'item').map((entry) => entry.sectionKey)
    ).toEqual([pinnedStatusSectionKey(customPinnedGroupKey('migration'), 'in-progress'), 'all'])
  })

  it('keeps the current status-ranked order within groups while respecting group order', () => {
    const rows = [
      workspace('needs-attention'),
      workspace('running'),
      workspace('other'),
      workspace('done')
    ]
    const memberships = Object.fromEntries(
      rows
        .slice(0, 2)
        .concat(rows.slice(3))
        .map((row) => [getWorktreeHostIdentity(row), 'migration'])
    )
    memberships[getWorktreeHostIdentity(rows[2]!)] = 'accessibility'
    const result = plan(rows, { groups, memberships }).render(new Set())
    expect(result.filter((row) => row.type === 'header').map((row) => row.label)).toEqual([
      'Migrations',
      'In progress',
      'Accessibility',
      'In progress'
    ])
    expect(result.filter((row) => row.type === 'item').map((row) => row.worktree.id)).toEqual([
      'needs-attention',
      'running',
      'done',
      'other'
    ])
  })

  it('collapses one named group and preserves preferred navigation occurrences', () => {
    const a = workspace('a'),
      b = workspace('b')
    const built = plan([a, b], {
      groups,
      memberships: {
        [getWorktreeHostIdentity(a)]: 'migration',
        [getWorktreeHostIdentity(b)]: 'accessibility'
      }
    })
    const key = customPinnedGroupKey('migration')
    expect(
      built
        .render(new Set([key]))
        .filter((row) => row.type === 'item')
        .map((row) => row.worktree.id)
    ).toEqual(['b'])
    expect(
      built.occurrencePlan.preferredByIdentity.get(getWorktreeHostIdentity(a))?.sectionPath.parent
        ?.key
    ).toBe(key)
  })

  it('keeps equal workspace ids on different hosts in separate groups', () => {
    const local = workspace('same'),
      remote = workspace('same', { hostId: 'ssh:server' })
    const result = plan([local, remote], {
      groups,
      memberships: { [getWorktreeHostIdentity(local)]: 'migration' }
    }).render(new Set())
    expect(
      result
        .filter((row) => row.type === 'item')
        .map((row) => [row.worktree.hostId, row.sectionKey])
    ).toEqual([
      ['local', pinnedStatusSectionKey(customPinnedGroupKey('migration'), 'in-progress')],
      ['ssh:server', 'all']
    ])
  })

  it('returns members to their natural or original pinned sections after group removal', () => {
    const regular = workspace('regular'),
      pinned = workspace('pinned', { isPinned: true })
    const result = plan([regular, pinned], {
      groups: [],
      memberships: { [getWorktreeHostIdentity(regular)]: 'deleted' }
    }).render(new Set())
    expect(
      result.filter((row) => row.type === 'item').map((row) => [row.worktree.id, row.sectionKey])
    ).toEqual([
      ['pinned', 'pinned'],
      ['regular', 'all']
    ])
  })

  it('supports independent collapse of a named group on a remote host', () => {
    const key = customPinnedGroupKey('migration')
    const remoteKey = getHostSectionCollapseKey(key, 'ssh:server')
    const row = workspace('remote', { hostId: 'ssh:server' })
    const rendered = plan([row], {
      groups,
      memberships: { [getWorktreeHostIdentity(row)]: 'migration' }
    }).render(new Set())
    const collapsed = scopeHostSectionCollapse({
      rows: rendered,
      collapsedGroups: new Set([remoteKey])
    })
    expect(collapsed.filter((entry) => entry.type === 'item')).toHaveLength(0)
    expect(collapsed[0]).toMatchObject({ type: 'header', collapseKey: remoteKey })
  })
})
