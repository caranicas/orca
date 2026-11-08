import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../shared/repo-types'
import { isGeneralWorkspaceRepo } from '../../../shared/general-workspace'
import { openGeneralWorkspace } from './open-general-workspace'

const mocks = vi.hoisted(() => ({
  getState: vi.fn(),
  create: vi.fn(),
  parent: vi.fn(),
  upsert: vi.fn(),
  activate: vi.fn(),
  closeFloating: vi.fn(),
  persistFloating: vi.fn(),
  fetch: vi.fn()
}))
vi.mock('@/store', () => ({ useAppStore: { getState: mocks.getState } }))
vi.mock('@/lib/workspace/activation/worktree-activation', () => ({
  activateAndRevealWorktree: mocks.activate
}))
vi.mock('@/components/sidebar/project-admission/completion/add-repo-store-upsert', () => ({
  upsertAddedRepoWithProjectHostSetup: mocks.upsert
}))
vi.mock('@/components/floating-terminal/floating-terminal-panel-view-state', () => ({
  persistFloatingTerminalPanelOpen: mocks.persistFloating
}))
vi.mock('@/store/workspaces/catalog/workspace-record-fields', () => ({
  selectWorktreesByRepo: (state: { worktreesByRepo: unknown }) => state.worktreesByRepo
}))

const general: Repo = {
  id: 'general',
  path: '/orca/projects/.orca-general/General',
  displayName: 'General',
  kind: 'folder',
  badgeColor: '#737373',
  addedAt: 1
}

let state: {
  repos: Repo[]
  fetchWorktrees: typeof mocks.fetch
  setFloatingWorkspacePanelOpen: typeof mocks.closeFloating
  activeWorktreeId: string | null
  activeView: string
  worktreesByRepo: Record<string, { id: string; hostId: string; isMainWorktree: boolean }[]>
}

beforeEach(() => {
  vi.clearAllMocks()
  state = {
    repos: [],
    fetchWorktrees: mocks.fetch,
    setFloatingWorkspacePanelOpen: mocks.closeFloating,
    activeWorktreeId: 'project-workspace',
    activeView: 'terminal',
    worktreesByRepo: {
      general: [
        { id: 'remote', hostId: 'runtime:server', isMainWorktree: true },
        { id: 'main', hostId: 'local', isMainWorktree: true },
        { id: 'child', hostId: 'local', isMainWorktree: false }
      ]
    }
  }
  mocks.getState.mockImplementation(() => state)
  mocks.parent.mockResolvedValue('/orca/projects')
  mocks.create.mockResolvedValue({ repo: general })
  mocks.fetch.mockResolvedValue(undefined)
  mocks.activate.mockReturnValue({ primaryTabId: 'existing-or-default-tab' })
  mocks.upsert.mockImplementation((repo: Repo) => {
    state.repos.push(repo)
    return { repo, alreadyPresent: false }
  })
  vi.stubGlobal('__ORCA_WEB_CLIENT__', false)
  vi.stubGlobal('window', {
    api: { repos: { create: mocks.create, getDefaultCreateProjectParent: mocks.parent } }
  })
})

afterEach(() => vi.unstubAllGlobals())

describe('General workspace', () => {
  it('creates a managed folder and opens its local root through normal workspace activation', async () => {
    await openGeneralWorkspace()
    expect(mocks.create).toHaveBeenCalledWith({
      parentPath: '/orca/projects/.orca-general',
      name: 'General',
      kind: 'folder'
    })
    expect(mocks.upsert).toHaveBeenCalledWith(general, { runtimeEnvironmentId: null })
    expect(mocks.fetch).toHaveBeenCalledWith('general', {
      requireAuthoritative: true,
      executionHostId: 'local'
    })
    expect(mocks.activate).toHaveBeenCalledWith('main', {
      executionHostId: 'local',
      navigationIntent: 'user-open',
      sidebarRevealBehavior: 'auto'
    })
    expect(mocks.closeFloating).toHaveBeenCalledWith(false)
    expect(mocks.persistFloating).toHaveBeenCalledWith(false)
  })

  it('reopens the same workspace after rename without recreating it or clearing its tabs', async () => {
    state.repos = [{ ...general, displayName: 'Scratchpad' }]
    await openGeneralWorkspace()
    await openGeneralWorkspace()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.parent).not.toHaveBeenCalled()
    expect(mocks.upsert).not.toHaveBeenCalled()
    expect(mocks.activate).toHaveBeenCalledTimes(2)
  })

  it('coalesces rapid clicks into one create and one activation', async () => {
    const first = openGeneralWorkspace()
    const second = openGeneralWorkspace()
    expect(first).toBe(second)
    await Promise.all([first, second])
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.activate).toHaveBeenCalledTimes(1)
  })

  it('does not reuse a remote project with the same path', async () => {
    state.repos = [{ ...general, executionHostId: 'runtime:server' }]
    await openGeneralWorkspace()
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.activate.mock.calls[0][0]).toBe('main')
  })

  it('leaves selection alone on creation failure and allows retry', async () => {
    mocks.create.mockResolvedValueOnce({ error: 'Folder is not writable' })
    await expect(openGeneralWorkspace()).rejects.toThrow('Folder is not writable')
    expect(mocks.activate).not.toHaveBeenCalled()
    expect(mocks.upsert).not.toHaveBeenCalled()
    await openGeneralWorkspace()
    expect(mocks.activate).toHaveBeenCalledTimes(1)
  })

  it('refuses a Git project returned for the reserved folder', async () => {
    mocks.create.mockResolvedValue({ repo: { ...general, kind: 'git' } })
    await expect(openGeneralWorkspace()).rejects.toThrow('already used by another project')
    expect(mocks.activate).not.toHaveBeenCalled()
  })

  it('does not create a local project from a paired browser client', async () => {
    vi.stubGlobal('__ORCA_WEB_CLIENT__', true)
    await expect(openGeneralWorkspace()).rejects.toThrow('desktop app')
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('recognizes managed Windows paths without relying on the display name', () => {
    expect(isGeneralWorkspaceRepo({ ...general, path: 'C:\\Orca\\.orca-general\\General' })).toBe(
      true
    )
    expect(isGeneralWorkspaceRepo({ ...general, path: '/somewhere/General' })).toBe(false)
    expect(isGeneralWorkspaceRepo({ ...general, path: '/orca/.ORCA-GENERAL/GENERAL' })).toBe(false)
  })

  it('keeps a later workspace choice when creation completes in the background', async () => {
    let finishParent: (path: string) => void = () => {
      throw new Error('Parent request has not started')
    }
    mocks.parent.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finishParent = resolve
        })
    )
    const opening = openGeneralWorkspace()
    state = { ...state, activeWorktreeId: 'chosen-later' }
    finishParent('/orca/projects')
    await opening
    expect(mocks.upsert).toHaveBeenCalledTimes(1)
    expect(mocks.activate).not.toHaveBeenCalled()
    expect(mocks.closeFloating).not.toHaveBeenCalled()
  })
})
