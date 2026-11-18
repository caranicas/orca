import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { ClaudeAgentViewService } from './agent-view-service'
import { reconcileClaudeAgentViewConfig } from './agent-view-config'
import { ensureClaudeAgentViewPluginAsync } from './agent-view-plugin'
import { resetLoginShellEnvironmentCacheForTests } from '../../startup/shell-environment/login-shell-environment'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  vi.unstubAllEnvs()
  vi.useRealTimers()
  resetLoginShellEnvironmentCacheForTests()
})

it('leaves Claude config untouched when the Claude CLI is not on PATH (#43445)', async () => {
  const root = await mkdtemp(join(tmpdir(), 'orca-agent-view-no-claude-'))
  roots.push(root)
  const config = join(root, 'claude')
  const service = new ClaudeAgentViewService(join(root, 'orca'), {
    reconcileConfig: reconcileClaudeAgentViewConfig,
    ensurePlugin: ensureClaudeAgentViewPluginAsync,
    listProfiles: async () => [join(root, 'account')],
    loginEnv: async () => ({ CLAUDE_CONFIG_DIR: config }),
    claudeOnPath: async () => false
  })
  await service.reconcile({})
  await service.prepareProfile(join(root, 'new-account'))

  await expect(readFile(join(config, 'keybindings.json'), 'utf8')).rejects.toThrow()
  await expect(readFile(join(config, 'orca-agent-view.json'), 'utf8')).rejects.toThrow()
  await expect(readFile(join(root, 'new-account', 'keybindings.json'), 'utf8')).rejects.toThrow()
})
