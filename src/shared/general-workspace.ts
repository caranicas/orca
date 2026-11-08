import type { Repo } from './repo-types'
import { getRepoExecutionHostId, LOCAL_EXECUTION_HOST_ID } from './execution-host'
import {
  isCaseInsensitiveRuntimeRoot,
  normalizeRuntimePathForComparison
} from './cross-platform-path'

export const GENERAL_WORKSPACE_PARENT = '.orca-general'
export const GENERAL_WORKSPACE_NAME = 'General'

export function isGeneralWorkspaceRepo(repo: Repo): boolean {
  if (repo.kind !== 'folder' || getRepoExecutionHostId(repo) !== LOCAL_EXECUTION_HOST_ID) {
    return false
  }
  const path = normalizeRuntimePathForComparison(repo.path)
  const suffix = `/${GENERAL_WORKSPACE_PARENT}/${GENERAL_WORKSPACE_NAME}`
  return path.endsWith(isCaseInsensitiveRuntimeRoot(repo.path) ? suffix.toLowerCase() : suffix)
}
