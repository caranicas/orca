// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import { useWorkspaceOrganization } from '@/store/workspace-organization'
import { getWorktreeHostIdentity } from '../../../../shared/worktree/host-qualified-identity'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { Repo } from '../../../../shared/repo-types'
import type { WorktreeCardProperty } from '../../../../shared/ui-chrome-types'
import type { Worktree } from '../../../../shared/worktree/types'

const fetchHostedReviewForBranch = vi.fn()
const fetchIssue = vi.fn()
const fetchLinearIssue = vi.fn()
const openModal = vi.fn()
const updateWorktreeMeta = vi.fn()

let worktreeCardProperties: WorktreeCardProperty[] = []
let settings: Partial<GlobalSettings> | null = null
const WORKTREE_CARD_IMPORT_TIMEOUT_MS = 15_000

vi.mock('@/store', () => {
  const getState = () => ({
    deleteStateByWorktreeId: {},
    fetchHostedReviewForBranch,
    fetchIssue,
    fetchLinearIssue,
    gitConflictOperationByWorktree: {},
    hostedReviewCache: {},
    issueCache: {},
    linearIssueCache: {},
    openModal,
    projectGroups: [],
    remoteBranchConflictByWorktreeId: {},
    settings,
    sshConnectionStates: new Map(),
    sshTargetLabels: new Map(),
    updateWorktreeMeta,
    workspacePortScan: null,
    worktreeCardProperties
  })
  return {
    useAppStore: Object.assign((selector: (state: unknown) => unknown) => selector(getState()), {
      getState,
      subscribe: () => () => {}
    })
  }
})

vi.mock('@/lib/worktree-activation', () => ({
  activateAndRevealWorktree: vi.fn()
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>
}))

vi.mock('./use-worktree-activity-status', () => ({
  useWorktreeActivityStatus: () => 'idle'
}))

vi.mock('./use-worktree-sleep-state', () => ({
  useIsSleepingWorktree: () => false
}))

vi.mock('./CacheTimer', () => ({
  default: () => null,
  usePromptCacheCountdownStartedAt: () => null
}))

vi.mock('./WorktreeCardAgents', () => ({
  default: () => null
}))

vi.mock('./WorktreeContextMenu', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
  WORKTREE_NATIVE_CONTEXT_MENU_ATTR: 'data-worktree-native-context-menu',
  WORKTREE_CONTEXT_MENU_SCOPE_ATTR: 'data-orca-context-menu-scope'
}))

function makeRepo(overrides: Partial<Repo> = {}): Repo {
  return {
    id: 'repo-1',
    path: '/repo',
    displayName: 'orca',
    badgeColor: '#999999',
    repoIcon: { type: 'emoji', emoji: '🦊' },
    addedAt: 1,
    ...overrides
  }
}

function makeWorktree(overrides: Partial<Worktree> = {}): Worktree {
  return {
    id: 'repo-1::/repo/worktrees/pinned',
    repoId: 'repo-1',
    path: '/repo/worktrees/pinned',
    displayName: 'Pinned tree',
    branch: 'feature/pinned',
    head: 'abc123',
    isBare: false,
    isMainWorktree: false,
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    isArchived: false,
    isUnread: false,
    isPinned: true,
    sortOrder: 0,
    lastActivityAt: 1,
    ...overrides
  }
}

afterEach(cleanup)

describe('WorktreeCard pinned repo icon', () => {
  it('tints the full card while preserving its color edge, status indicator, and active state', async () => {
    const { default: WorktreeCard } = await import('./WorktreeCard')
    const worktree = makeWorktree()
    worktreeCardProperties = ['status']
    useWorkspaceOrganization.getState().setColor([getWorktreeHostIdentity(worktree)], '#f97316')
    const view = render(
      <WorktreeCard worktree={worktree} repo={makeRepo()} isActive={false} inPinnedSection />
    )
    const surface = view.container.querySelector<HTMLElement>('[data-worktree-card-surface]')!
    expect(surface.style.backgroundImage).toContain('color-mix(in srgb, #f97316 10%, transparent)')
    expect(surface.querySelector('[data-workspace-color="#f97316"]')).not.toBeNull()
    expect(surface.querySelector('[data-worktree-card-status-slot]')).not.toBeNull()
    view.rerender(<WorktreeCard worktree={worktree} repo={makeRepo()} isActive inPinnedSection />)
    expect(surface.getAttribute('data-worktree-card-active')).toBe('primary')
    expect(surface.style.backgroundImage).toContain('#f97316')
  })

  beforeEach(() => {
    vi.clearAllMocks()
    useWorkspaceOrganization.setState({ grouping: { groups: [], memberships: {} }, colors: {} })
    worktreeCardProperties = []
    settings = null
  })

  it(
    'shows the repo icon and project name for pinned cards even when the repo badge is hidden',
    async () => {
      const { default: WorktreeCard } = await import('./WorktreeCard')

      const markup = renderToStaticMarkup(
        <WorktreeCard
          worktree={makeWorktree()}
          repo={makeRepo()}
          isActive={false}
          inPinnedSection
          hideRepoBadge
        />
      )

      expect(markup).toContain('🦊')
      expect(markup).toContain('Project orca')
      expect(markup).toContain('>orca</span>')
    },
    WORKTREE_CARD_IMPORT_TIMEOUT_MS
  )

  it(
    'does not render the leading pinned repo icon for non-pinned cards',
    async () => {
      const { default: WorktreeCard } = await import('./WorktreeCard')

      const markup = renderToStaticMarkup(
        <WorktreeCard
          worktree={makeWorktree({ isPinned: false })}
          repo={makeRepo()}
          isActive={false}
        />
      )

      expect(markup).not.toContain('🦊')
      expect(markup).not.toContain('Project orca')
    },
    WORKTREE_CARD_IMPORT_TIMEOUT_MS
  )

  it(
    'uses the pinned-style repo icon in new card style instead of a metadata-row badge',
    async () => {
      settings = { compactWorktreeCards: false, experimentalNewWorktreeCardStyle: true }
      worktreeCardProperties = ['status']
      const { default: WorktreeCard } = await import('./WorktreeCard')

      const markup = renderToStaticMarkup(
        <WorktreeCard
          worktree={makeWorktree({ isPinned: false })}
          repo={makeRepo()}
          isActive={false}
        />
      )

      expect(markup).toContain('🦊')
      expect(markup).toContain('Project orca')
      expect(markup).toContain('>orca</span>')
      expect(markup).not.toContain('data-worktree-card-meta-row=""')
    },
    WORKTREE_CARD_IMPORT_TIMEOUT_MS
  )

  it(
    'shows the project name on ungrouped compact cards and hides it when grouped by project',
    async () => {
      settings = { compactWorktreeCards: true, experimentalNewWorktreeCardStyle: false }
      const { default: WorktreeCard } = await import('./WorktreeCard')
      const worktree = makeWorktree({ isPinned: false, displayName: 'main' })

      const ungrouped = renderToStaticMarkup(
        <WorktreeCard worktree={worktree} repo={makeRepo()} isActive={false} />
      )
      expect(ungrouped).toContain('>orca</span>')
      expect(ungrouped).toContain('Project orca')

      const groupedByProject = renderToStaticMarkup(
        <WorktreeCard worktree={worktree} repo={makeRepo()} isActive={false} hideRepoBadge />
      )
      expect(groupedByProject).not.toContain('>orca</span>')
      expect(groupedByProject).not.toContain('Project orca')
    },
    WORKTREE_CARD_IMPORT_TIMEOUT_MS
  )
})
