import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { runProcessSync } from '@orca/process-host'
import { resolvePullRequestDiffBase } from './git-pull-request-diff-base.mjs'

afterEach(() => vi.unstubAllEnvs())

it('compares fork code analysis with upstream while other PR gates retain the first parent', () => {
  const repo = mkdtempSync(path.join(tmpdir(), 'orca-fork-diff-'))
  const git = (...args: string[]): string => {
    const result = runProcessSync({
      program: 'git',
      args: [
        '-c',
        'commit.gpgsign=false',
        '-c',
        'user.name=Test',
        '-c',
        'user.email=test@example.invalid',
        '-c',
        `core.hooksPath=${path.join(repo, '.git', 'no-hooks')}`,
        ...args
      ],
      cwd: repo
    })
    expect(result.code, result.stderr).toBe(0)
    return result.stdout.trim()
  }
  try {
    git('init', '--quiet')
    writeFileSync(path.join(repo, 'base.txt'), 'base\n')
    git('add', '.')
    git('commit', '-qm', 'base')
    const base = git('rev-parse', 'HEAD')
    git('checkout', '-qb', 'upstream')
    writeFileSync(path.join(repo, 'upstream.txt'), 'upstream\n')
    git('add', '.')
    git('commit', '-qm', 'upstream')
    const upstream = git('rev-parse', 'HEAD')
    git('checkout', '-qb', 'fork', base)
    writeFileSync(path.join(repo, 'custom.txt'), 'custom\n')
    git('add', '.')
    git('commit', '-qm', 'custom')
    const firstParent = git('rev-parse', 'HEAD')
    git('merge', '--no-ff', '-qm', 'integrate', 'upstream')

    vi.stubEnv('ORCA_CODE_ANALYSIS_BASE', '')
    expect(resolvePullRequestDiffBase(repo, base, 'pull_request')).toBe(firstParent)
    vi.stubEnv('ORCA_CODE_ANALYSIS_BASE', upstream)
    expect(resolvePullRequestDiffBase(repo, base, 'pull_request')).toBe(upstream)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

it('rejects invalid code-analysis baseline inputs', () => {
  vi.stubEnv('ORCA_CODE_ANALYSIS_BASE', '--all')
  expect(() => resolvePullRequestDiffBase(process.cwd(), 'main', 'pull_request')).toThrow(
    'must be a full commit SHA'
  )
})
