import { useAppStore } from '@/store'
import { joinPath } from './path'
import { isPairedWebClientWindow } from '../app-shell/chrome/desktop-window-chrome'
import { activateAndRevealWorktree } from './workspace/activation/worktree-activation'
import { translate } from '@/i18n/i18n'
import { upsertAddedRepoWithProjectHostSetup } from '@/components/sidebar/project-admission/completion/add-repo-store-upsert'
import { worktreeRefreshOptions } from '@/components/sidebar/project-admission/host-selection/add-repo-runtime-owner'
import { selectWorktreesByRepo } from '@/store/workspaces/catalog/workspace-record-fields'
import { LOCAL_EXECUTION_HOST_ID } from '../../../shared/execution-host'
import {
  GENERAL_WORKSPACE_NAME,
  GENERAL_WORKSPACE_PARENT,
  isGeneralWorkspaceRepo
} from '../../../shared/general-workspace'
import { repoCreateErrorText } from '@/components/sidebar/project-admission/create/repo-create-error-copy'
import { persistFloatingTerminalPanelOpen } from '@/components/floating-terminal/floating-terminal-panel-view-state'

let openingGeneral: Promise<void> | null = null

async function createAndOpenGeneralWorkspace(): Promise<void> {
  if (isPairedWebClientWindow()) {
    throw new Error(translate('custom.general.localOnly', 'Open General from the desktop app.'))
  }
  const initialState = useAppStore.getState()
  let repo = initialState.repos.find(isGeneralWorkspaceRepo)
  if (!repo) {
    const parent = await window.api.repos.getDefaultCreateProjectParent()
    const result = await window.api.repos.create({
      parentPath: joinPath(parent, GENERAL_WORKSPACE_PARENT),
      name: GENERAL_WORKSPACE_NAME,
      kind: 'folder'
    })
    if ('error' in result) {
      throw new Error(repoCreateErrorText(result))
    }
    if (!isGeneralWorkspaceRepo(result.repo)) {
      throw new Error(
        translate(
          'custom.general.folderConflict',
          'The General workspace location is already used by another project.'
        )
      )
    }
    repo = upsertAddedRepoWithProjectHostSetup(result.repo, { runtimeEnvironmentId: null }).repo
  }
  await useAppStore.getState().fetchWorktrees(repo.id, worktreeRefreshOptions(null))
  const worktree = selectWorktreesByRepo(useAppStore.getState())[repo.id]?.find(
    (entry) => entry.hostId === LOCAL_EXECUTION_HOST_ID && entry.isMainWorktree
  )
  if (!worktree) {
    throw new Error(
      translate(
        'custom.general.workspaceUnavailable',
        'General could not be loaded. Try opening it again.'
      )
    )
  }
  const current = useAppStore.getState()
  if (
    current.activeWorktreeId !== initialState.activeWorktreeId ||
    current.activeView !== initialState.activeView
  ) {
    return
  }
  const result = activateAndRevealWorktree(worktree.id, {
    executionHostId: LOCAL_EXECUTION_HOST_ID,
    navigationIntent: 'user-open',
    sidebarRevealBehavior: 'auto'
  })
  if (result === false) {
    throw new Error(translate('custom.general.openFailed', 'General could not be opened.'))
  }
  useAppStore.getState().setFloatingWorkspacePanelOpen(false)
  persistFloatingTerminalPanelOpen(false)
}

export function openGeneralWorkspace(): Promise<void> {
  if (!openingGeneral) {
    openingGeneral = createAndOpenGeneralWorkspace().finally(() => {
      openingGeneral = null
    })
  }
  return openingGeneral
}
