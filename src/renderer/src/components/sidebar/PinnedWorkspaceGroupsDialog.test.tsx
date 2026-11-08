// @vitest-environment happy-dom
import { act } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PinnedWorkspaceGroupsDialog } from './PinnedWorkspaceGroupsDialog'
import { useWorkspaceOrganization } from '@/store/workspace-organization'

beforeEach(() =>
  useWorkspaceOrganization.setState({
    grouping: {
      groups: [
        { id: 'one', name: 'Migrations' },
        { id: 'two', name: 'Accessibility' }
      ],
      memberships: { 'local|repo::/feature': 'one' }
    },
    colors: {},
    managerOpen: true
  })
)
afterEach(cleanup)

describe('pinned group editor', () => {
  it('saves renamed and reordered groups without losing membership', () => {
    render(<PinnedWorkspaceGroupsDialog />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Group name 1' }), {
      target: { value: 'Components' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Move Components down' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(useWorkspaceOrganization.getState().grouping).toEqual({
      groups: [
        { id: 'two', name: 'Accessibility' },
        { id: 'one', name: 'Components' }
      ],
      memberships: { 'local|repo::/feature': 'one' }
    })
  })

  it('discards deletions when cancelled and clears only membership when saved', () => {
    const view = render(<PinnedWorkspaceGroupsDialog />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove group Migrations' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(useWorkspaceOrganization.getState().grouping.groups).toHaveLength(2)
    act(() => useWorkspaceOrganization.getState().setManagerOpen(true))
    view.rerender(<PinnedWorkspaceGroupsDialog />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove group Migrations' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(useWorkspaceOrganization.getState().grouping.memberships).toEqual({})
    expect(useWorkspaceOrganization.getState().grouping.groups).toEqual([
      { id: 'two', name: 'Accessibility' }
    ])
  })

  it('requires a name when creating a group', () => {
    render(<PinnedWorkspaceGroupsDialog />)
    fireEvent.click(screen.getByRole('button', { name: 'Add group' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert').textContent).toBe('Give every group a name.')
    fireEvent.change(screen.getByRole('textbox', { name: 'Group name 3' }), {
      target: { value: 'Follow up' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(useWorkspaceOrganization.getState().grouping.groups.map((group) => group.name)).toEqual([
      'Migrations',
      'Accessibility',
      'Follow up'
    ])
  })
})
