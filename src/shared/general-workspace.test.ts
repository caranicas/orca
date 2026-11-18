import { expect, it } from 'vitest'
import type { Repo } from './repository/repo-types'
import { isGeneralWorkspaceRepo } from './general-workspace'

it('recognizes managed Windows folders after rename without confusing ordinary folders', () => {
  const repo: Repo = {
    id: 'general',
    path: 'C:\\Orca\\.orca-general\\General',
    displayName: 'Scratchpad',
    kind: 'folder',
    badgeColor: '#737373',
    addedAt: 1
  }
  expect(isGeneralWorkspaceRepo(repo)).toBe(true)
  expect(isGeneralWorkspaceRepo({ ...repo, path: '/somewhere/General' })).toBe(false)
  expect(isGeneralWorkspaceRepo({ ...repo, path: '/orca/.ORCA-GENERAL/GENERAL' })).toBe(false)
})
