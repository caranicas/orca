// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useWorkspaceOrganization } from '@/store/workspace-organization'
import type { Worktree } from '../../../../shared/worktree/types'
import { useWorkspaceAppearanceDraft, WorkspaceAppearanceFields } from './WorkspaceAppearanceFields'

const worktree: Worktree = {
  id: 'repo::/feature',
  hostId: 'local',
  repoId: 'repo',
  path: '/feature',
  head: 'abc',
  branch: 'feature',
  isBare: false,
  isMainWorktree: false,
  displayName: 'Feature',
  comment: '',
  linkedIssue: null,
  linkedPR: null,
  linkedLinearIssue: null,
  isArchived: false,
  isUnread: false,
  isPinned: false,
  sortOrder: 0,
  lastActivityAt: 0
}

function Editor() {
  const draft = useWorkspaceAppearanceDraft(worktree)
  return (
    <>
      <WorkspaceAppearanceFields draft={draft} disabled={false} isFolderWorkspace={false} />
      <button onClick={draft.save}>Save appearance</button>
    </>
  )
}

beforeEach(() =>
  useWorkspaceOrganization.setState({ grouping: { groups: [], memberships: {} }, colors: {} })
)
afterEach(cleanup)

describe('workspace appearance draft', () => {
  it('offers deep blue as a saved workspace color', () => {
    render(<Editor />)
    fireEvent.click(screen.getByRole('button', { name: 'Deep blue' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save appearance' }))
    expect(useWorkspaceOrganization.getState().colors['local|repo::/feature']).toBe('#1d4ed8')
  })
  it('keeps color changes pending until Save, and can remove a saved color', () => {
    const view = render(<Editor />)
    fireEvent.click(screen.getByRole('button', { name: 'Green' }))
    expect(useWorkspaceOrganization.getState().colors).toEqual({})
    fireEvent.click(screen.getByRole('button', { name: 'Save appearance' }))
    expect(useWorkspaceOrganization.getState().colors['local|repo::/feature']).toBe('#22c55e')
    view.unmount()
    render(<Editor />)
    fireEvent.click(screen.getByRole('button', { name: 'No color' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save appearance' }))
    expect(useWorkspaceOrganization.getState().colors).toEqual({})
  })

  it('does not persist a dismissed draft or overwrite a concurrent group change', () => {
    const view = render(<Editor />)
    fireEvent.click(screen.getByRole('button', { name: 'Purple' }))
    view.unmount()
    expect(useWorkspaceOrganization.getState().colors).toEqual({})
    render(<Editor />)
    useWorkspaceOrganization.getState().saveGroups([{ id: 'a', name: 'Migrations' }])
    useWorkspaceOrganization.getState().assignGroup(['local|repo::/feature'], 'a')
    fireEvent.click(screen.getByRole('button', { name: 'Save appearance' }))
    expect(useWorkspaceOrganization.getState().grouping.memberships['local|repo::/feature']).toBe(
      'a'
    )
  })
})
