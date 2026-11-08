// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { normalizeWorkspaceOrganization, useWorkspaceOrganization } from './workspace-organization'

beforeEach(() => {
  localStorage.clear()
  useWorkspaceOrganization.setState({
    grouping: { groups: [], memberships: {} },
    colors: {},
    managerOpen: false
  })
})

describe('workspace organization persistence', () => {
  it('restores names, membership, order, and colors after hydration', async () => {
    const store = useWorkspaceOrganization.getState()
    store.saveGroups([
      { id: 'b', name: 'Accessibility' },
      { id: 'a', name: 'Migrations' }
    ])
    store.assignGroup(['local|repo::/a'], 'a')
    store.setColor(['local|repo::/a'], '#abc')
    const saved = localStorage.getItem('orca.workspace-organization.v1')!
    useWorkspaceOrganization.setState({ grouping: { groups: [], memberships: {} }, colors: {} })
    localStorage.setItem('orca.workspace-organization.v1', saved)
    await useWorkspaceOrganization.persist.rehydrate()
    expect(useWorkspaceOrganization.getState().grouping).toEqual({
      groups: [
        { id: 'b', name: 'Accessibility' },
        { id: 'a', name: 'Migrations' }
      ],
      memberships: { 'local|repo::/a': 'a' }
    })
    expect(useWorkspaceOrganization.getState().colors).toEqual({ 'local|repo::/a': '#aabbcc' })
  })

  it('removes group membership without removing colors or workspace records', () => {
    const store = useWorkspaceOrganization.getState()
    store.saveGroups([{ id: 'a', name: 'Group' }])
    store.assignGroup(['local|repo::/a', 'ssh:host|repo::/a'], 'a')
    store.setColor(['local|repo::/a'], '#22c55e')
    store.saveGroups([])
    expect(useWorkspaceOrganization.getState().grouping.memberships).toEqual({})
    expect(useWorkspaceOrganization.getState().colors).toEqual({ 'local|repo::/a': '#22c55e' })
  })

  it('ignores invalid saved data and CSS values', () => {
    expect(
      normalizeWorkspaceOrganization({
        grouping: {
          groups: [null, { id: 'a', name: ' OK ' }, { id: 'a', name: 'Duplicate' }],
          memberships: { valid: 'a', invalid: 'missing' }
        },
        colors: { invalid: 'url(https://example.com)', valid: '#fff' }
      })
    ).toEqual({
      grouping: { groups: [{ id: 'a', name: 'OK' }], memberships: { valid: 'a' } },
      colors: { valid: '#ffffff' }
    })
  })
})
