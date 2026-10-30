import type { Worktree } from '../worktree/types'
import { ALL_GROUP_KEY } from './group-keys'
import {
  hasCustomPinnedGroup,
  isPinnedSectionKey,
  partitionPinnedWorkspaces
} from './custom-pinned-groups'
import { appendOrderedGroups } from './group-sections'
import type { SectionAppendContext } from './group-sections'
import {
  getLaneHostWorktreeCounts,
  getLaneHostWorktreeIds,
  getMixedWorktreeHostContextLabels,
  getNoticeHostContextLabels
} from './host-labels'
import { buildProjectGroupingIndex, getProjectGroupingForRepo } from '../project-section-grouping'
import {
  buildWorktreeOccurrencePlan,
  type WorktreeOccurrenceSection
} from '../worktree-occurrence-plan'
import { getWorktreeHostIdentity } from '../worktree/host-qualified-identity'
import type { OrderedGroupEntry, WorktreeGroupEntry } from './worktree-group-entry'
import {
  appendProjectGroupSections,
  getProjectGroupOccurrencePaths
} from './project-group-sections'
import { getSidebarLineageChildren } from './pinned-section-worktrees'
import { emitPinnedGroup } from './pinned-group-rows'
import { buildPinnedGroupHeader } from './pinned-group-header'
import { buildPinnedStatusSections } from './pinned-status-sections'
import {
  appendWorktreeRows,
  buildFolderWorkspaceRow,
  buildPendingCreationRow
} from './row-builders'
import {
  compareFolderWorkspacesForDisplay,
  getRenderableFolderWorkspaces
} from './folder-workspace-lanes'
import type { PendingCreationRef, Row } from './row-types'
import { orderMainWorktreeFirst, getRenderedNaturalAnchorRepoIds } from './section-order'
import { withRepoSectionDisplayLabels } from '../project-section-order'
import { buildOrderedGroups } from './worktree-grouping'

type SidebarOccurrenceSection = WorktreeOccurrenceSection<Worktree> & { group: WorktreeGroupEntry }

/** Everything the row builder reads. Pure data: no store, clock or client-specific state. */
import type { SidebarRowPlanInputs } from './sidebar-row-plan-inputs'
export type { SidebarRowPlanInputs } from './sidebar-row-plan-inputs'

/** Plans the sidebar's sections once; `render` emits rows for a collapse state. */
export function planSidebarRows(inputs: SidebarRowPlanInputs) {
  const {
    groupBy,
    worktrees,
    repoMap,
    repoOfWorktree,
    prGroupOf,
    repoOrder,
    workspaceStatuses,
    projectOrderBy,
    lineageById,
    worktreeMap,
    nestLineage,
    projectGroups,
    placeholderRepoIds,
    importedWorktreesByRepo,
    newExternalWorktreesInboxByRepo,
    pendingCreations,
    projectGrouping,
    folderWorkspaces,
    hostLabelById,
    defaultHostId,
    pinnedDisplayPolicy,
    filterRepoIds
  } = inputs
  const projectIndex = buildProjectGroupingIndex(projectGrouping)
  const repoOf = repoOfWorktree ?? ((worktree: Worktree) => repoMap.get(worktree.repoId))
  // Resolve folder membership before groupBy; every mode renders the same set (#15362).
  const renderableFolderWorkspaces = getRenderableFolderWorkspaces(folderWorkspaces, projectGroups)
  const pendingByRepo = new Map<string, PendingCreationRef[]>()
  for (const creation of pendingCreations) {
    const list = pendingByRepo.get(creation.repoId) ?? []
    list.push(creation)
    pendingByRepo.set(creation.repoId, list)
  }

  const projectGroupPaths = getProjectGroupOccurrencePaths(projectGroups)
  const childrenByParentIdentity = nestLineage
    ? getSidebarLineageChildren(worktrees, lineageById, worktreeMap, filterRepoIds)
    : new Map<string, Worktree[]>()
  const occurrencePlan = buildWorktreeOccurrencePlan({
    rows: worktrees,
    identityOf: getWorktreeHostIdentity,
    childrenByParentIdentity,
    isPinned: (worktree) =>
      worktree.isPinned === true || hasCustomPinnedGroup(worktree, inputs.pinnedWorkspaceGrouping),
    duplicatePinned: pinnedDisplayPolicy === 'duplicate-in-groups',
    owningSectionOf: (worktree) =>
      getProjectGroupingForRepo(worktree.repoId, repoMap, projectIndex),
    projectIdOf: (worktree) => worktree.repoId,
    sectionsOf: ({ pinned, natural, displayRootByIdentity }) => {
      const groups: OrderedGroupEntry[] =
        groupBy === 'none'
          ? [[ALL_GROUP_KEY, { label: '', items: [...natural], repoIds: new Set() }]]
          : buildOrderedGroups({
              groupBy,
              naturalWorktrees: natural,
              repoMap,
              prGroupOf,
              workspaceStatuses,
              projectIndex,
              displayRootByIdentity,
              placeholderRepoIds,
              importedWorktreesByRepo,
              newExternalWorktreesInboxByRepo,
              pendingByRepo,
              repoOrder,
              projectOrderBy,
              folderWorkspaces: renderableFolderWorkspaces
            })
      const pinnedGroups = buildPinnedStatusSections(
        partitionPinnedWorkspaces(pinned, inputs.pinnedWorkspaceGrouping, childrenByParentIdentity),
        workspaceStatuses
      )
      groups.unshift(...pinnedGroups)
      return groups.map(([key, group]): SidebarOccurrenceSection => {
        const revealPath =
          groupBy === 'repo' && !isPinnedSectionKey(key) && group.repo?.projectGroupId
            ? projectGroupPaths.get(group.repo.projectGroupId)
            : undefined
        return {
          key,
          group,
          placement: isPinnedSectionKey(key) ? 'pinned' : 'natural',
          items:
            groupBy === 'repo' && !isPinnedSectionKey(key)
              ? orderMainWorktreeFirst(group.items)
              : group.items,
          revealPath: {
            key,
            parent: group.pinnedParent ? { key: group.pinnedParent.key } : revealPath
          }
        }
      })
    }
  })
  const pinnedSections = occurrencePlan.sections.filter((section) =>
    isPinnedSectionKey(section.key)
  )
  const orderedGroups: OrderedGroupEntry[] = occurrencePlan.sections
    .filter((section) => !isPinnedSectionKey(section.key))
    .map((section) => [section.key, section.group])
  const naturalWorktrees = orderedGroups.flatMap(([, group]) => group.items)
  const render = (collapsedGroups: Set<string>): Row[] => {
    const result: Row[] = []
    if (groupBy !== 'repo') {
      for (const creation of pendingCreations) {
        result.push(buildPendingCreationRow(creation, repoMap))
      }
    }
    // Include pinned-only rows when testing mixed hosts or pinned remotes lose host labels.
    const mixedWorktreeHostContextLabels = getMixedWorktreeHostContextLabels(
      worktrees,
      repoOf,
      hostLabelById,
      defaultHostId
    )
    // Project ambiguity is independent of section/host filters; repoMap decides it, candidate maps gate notice eligibility.
    const noticeHostContextLabelByRepoId = getNoticeHostContextLabels(
      new Set([...importedWorktreesByRepo.keys(), ...newExternalWorktreesInboxByRepo.keys()]),
      repoMap.keys(),
      repoMap,
      projectIndex,
      hostLabelById
    )
    const renderedNaturalAnchorRepoIds = getRenderedNaturalAnchorRepoIds({
      groupBy,
      worktrees: naturalWorktrees,
      repoMap,
      prGroupOf,
      collapsedGroups,
      workspaceStatuses,
      projectGrouping
    })
    const remainingImported = new Map(importedWorktreesByRepo)
    const emittedPinnedParents = new Set<string>()
    for (const section of pinnedSections) {
      const parent = section.group.pinnedParent
      if (parent && !emittedPinnedParents.has(parent.key)) {
        result.push(buildPinnedGroupHeader(parent.items, repoOf, defaultHostId, parent))
        emittedPinnedParents.add(parent.key)
      }
      if (parent && collapsedGroups.has(parent.key)) {
        continue
      }
      emitPinnedGroup(
        section.group.items,
        repoOf,
        defaultHostId,
        collapsedGroups,
        renderedNaturalAnchorRepoIds,
        remainingImported,
        groupBy !== 'repo',
        result,
        occurrencePlan,
        noticeHostContextLabelByRepoId,
        mixedWorktreeHostContextLabels,
        {
          key: section.key,
          label: section.group.label,
          ...(parent ? { parentGroupKey: parent.key, groupDepth: 1 } : {}),
          ...(section.group.pinnedStatus
            ? { icon: { kind: 'workspace-status', status: section.group.pinnedStatus } }
            : {})
        }
      )
      for (const worktree of section.group.items) {
        remainingImported.delete(worktree.repoId)
      }
    }
    if (groupBy === 'none') {
      // Folder-only accounts must still render flat rows (#15362).
      if (naturalWorktrees.length > 0 || renderableFolderWorkspaces.length > 0) {
        result.push({
          type: 'header',
          key: ALL_GROUP_KEY,
          count: naturalWorktrees.length + renderableFolderWorkspaces.length,
          icon: { kind: 'all' },
          hostWorktreeCounts: getLaneHostWorktreeCounts(
            naturalWorktrees,
            renderableFolderWorkspaces,
            repoOf,
            defaultHostId
          ),
          hostWorktreeIds: getLaneHostWorktreeIds(
            naturalWorktrees,
            renderableFolderWorkspaces,
            repoOf,
            defaultHostId
          ),
          worktreeIds: naturalWorktrees.map((worktree) => worktree.id)
        })
        if (!collapsedGroups.has(ALL_GROUP_KEY)) {
          appendWorktreeRows(result, repoOf, occurrencePlan, {
            collapsedGroups,
            groupDepth: 0,
            sectionKey: ALL_GROUP_KEY,
            hostContextLabelByWorktreeIdentity: mixedWorktreeHostContextLabels
          })
          for (const pair of [...renderableFolderWorkspaces].sort((left, right) =>
            compareFolderWorkspacesForDisplay(left.folderWorkspace, right.folderWorkspace)
          )) {
            result.push(buildFolderWorkspaceRow(pair, 0))
          }
        }
      }
      return result
    }

    const sectionContext: SectionAppendContext = {
      result,
      groupBy,
      collapsedGroups,
      workspaceStatuses,
      repoMap,
      repoOf,
      defaultHostId,
      hostLabelById,
      projectIndex,
      importedWorktreesByRepo,
      newExternalWorktreesInboxByRepo,
      pendingByRepo,
      mixedWorktreeHostContextLabels,
      noticeHostContextLabelByRepoId,
      occurrencePlan
    }

    if (groupBy !== 'repo' || projectGroups.length === 0) {
      appendOrderedGroups(
        sectionContext,
        groupBy === 'repo' ? withRepoSectionDisplayLabels(orderedGroups) : orderedGroups
      )
      return result
    }

    appendProjectGroupSections(sectionContext, {
      orderedGroups,
      projectGroups,
      folderWorkspaces: renderableFolderWorkspaces,
      projectOrderBy,
      repoOrder
    })

    return result
  }
  return { occurrencePlan, render }
}
