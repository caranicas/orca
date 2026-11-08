import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, expect, it, vi } from 'vitest'
import { runProcessSync } from '@orca/process-host'
import {
  applyForkUpdate,
  checkForkUpdate
} from '../../../custom-tools/updates/fork-source-update.mjs'
import { readState } from '../../../custom-tools/updates/fork-update-state.mjs'

const sandboxes: string[] = []
afterEach(() => {
  vi.unstubAllEnvs()
  for (const sandbox of sandboxes.splice(0)) {
    if (!sandbox.startsWith(path.resolve(tmpdir()) + path.sep)) {
      throw new Error('Unexpected test cleanup target')
    }
    rmSync(sandbox, { recursive: true, force: true })
  }
})

function fixture() {
  const sandbox = mkdtempSync(path.join(tmpdir(), 'orca-fork-update-'))
  sandboxes.push(sandbox)
  const root = path.join(sandbox, 'checkout')
  const remote = path.join(sandbox, 'remote.git')
  const profile = path.join(sandbox, 'profile')
  mkdirSync(root)
  mkdirSync(profile)
  const pnpmEntry = path.join(sandbox, 'pnpm.cjs')
  writeFileSync(
    pnpmEntry,
    `
    if (process.argv[2] === '--version') { console.log('12.14.0'); process.exit(0) }
    const fs = require('node:fs')
    fs.mkdirSync('out/mobile-web', { recursive: true })
    fs.writeFileSync('out/mobile-web/manifest.json', '{"schemaVersion":1,"pageVersion":3}')
    fs.writeFileSync('out/app.js', 'built by resolved pnpm')
  `
  )
  vi.stubEnv('npm_execpath', pnpmEntry)
  writeFileSync(path.join(profile, 'saved-work.json'), '{"tabs":["existing-agent"]}')
  const git = (...args: string[]) => {
    const result = runProcessSync({
      program: 'git',
      cwd: root,
      args: [
        '-c',
        'commit.gpgsign=false',
        '-c',
        'user.name=Test',
        '-c',
        'user.email=test@example.invalid',
        ...args
      ]
    })
    expect(result.code, result.stderr).toBe(0)
    return result.stdout.trim()
  }
  git('init', '--bare', '--quiet', remote)
  git('init', '--quiet', '-b', 'main')
  git('config', `url.${pathToFileURL(remote).href}.insteadOf`, 'https://github.com/test/fork.git')
  git('remote', 'add', 'origin', 'https://github.com/test/fork.git')
  writeFileSync(path.join(root, '.gitignore'), 'out/\n')
  writeFileSync(path.join(root, 'app.txt'), 'old application')
  writeFileSync(path.join(root, 'notes.txt'), 'initial notes')
  git('add', '.')
  git('commit', '-qm', 'old application')
  git('push', '--quiet', 'origin', 'main')
  git('checkout', '-qb', 'candidate')
  writeFileSync(path.join(root, 'app.txt'), 'new application')
  git('commit', '-qam', 'new application')
  git('push', '--quiet', 'origin', 'HEAD:main')
  git('checkout', '-q', 'main')
  mkdirSync(path.join(root, 'out'))
  writeFileSync(path.join(root, 'out/app.js'), 'old built application')
  const settings = { repository: 'test/fork', branch: 'main', intervalHours: 72 }
  const snapshot = async (_root: string, source: string, destination: string) => {
    cpSync(source, destination, { recursive: true })
    writeFileSync(path.join(destination, 'manifest.json'), '{}')
  }
  const install = async () => {
    writeFileSync(path.join(root, 'out/app.js'), 'new built application')
  }
  return { root, profile, git, settings, snapshot, install }
}

it('installs validated fork main and retains the previous build and selected profile', async () => {
  const f = fixture()
  await checkForkUpdate(f)
  const state = await applyForkUpdate(f)
  expect(state.status).toBe('current')
  expect(readFileSync(path.join(f.root, 'app.txt'), 'utf8')).toBe('new application')
  expect(readFileSync(path.join(f.root, 'out/app.js'), 'utf8')).toBe('new built application')
  expect(readFileSync(path.join(state.backup, 'out/app.js'), 'utf8')).toBe('old built application')
  expect(readFileSync(path.join(f.profile, 'saved-work.json'), 'utf8')).toBe(
    '{"tabs":["existing-agent"]}'
  )
})

it('holds installation while the desktop runner is alive', async () => {
  const f = fixture()
  await checkForkUpdate(f)
  writeFileSync(
    path.join(f.root, 'out/dev-instance.json'),
    JSON.stringify({ runnerPid: process.pid })
  )
  expect((await applyForkUpdate(f)).status).toBe('pending')
  expect(readFileSync(path.join(f.root, 'app.txt'), 'utf8')).toBe('old application')
})

it('preserves dirty source changes instead of installing over them', async () => {
  const f = fixture()
  await checkForkUpdate(f)
  writeFileSync(path.join(f.root, 'app.txt'), 'my uncommitted work')
  expect((await applyForkUpdate(f)).status).toBe('held')
  expect(readFileSync(path.join(f.root, 'app.txt'), 'utf8')).toBe('my uncommitted work')
})

it('does not merge divergent local commits', async () => {
  const f = fixture()
  writeFileSync(path.join(f.root, 'app.txt'), 'my committed customization')
  f.git('commit', '-qam', 'local customization')
  expect((await checkForkUpdate(f)).status).toBe('held')
  expect(readFileSync(path.join(f.root, 'app.txt'), 'utf8')).toBe('my committed customization')
})

it('restores the prior source and build after an installation failure', async () => {
  const f = fixture()
  await checkForkUpdate(f)
  const install = async () => {
    if (readFileSync(path.join(f.root, 'app.txt'), 'utf8') === 'new application') {
      writeFileSync(path.join(f.root, 'out/app.js'), 'partial failed build')
      throw new Error('candidate build failed')
    }
    writeFileSync(path.join(f.root, 'out/app.js'), 'rebuilt previous application')
  }
  const state = await applyForkUpdate({ ...f, install })
  expect(state.status).toBe('failed')
  expect(readFileSync(path.join(f.root, 'app.txt'), 'utf8')).toBe('old application')
  expect(readFileSync(path.join(f.root, 'out/app.js'), 'utf8')).toBe('old built application')
  expect(readFileSync(path.join(f.profile, 'saved-work.json'), 'utf8')).toBe(
    '{"tabs":["existing-agent"]}'
  )
  expect(existsSync(path.join(state.backup, 'profile/manifest.json'))).toBe(true)
  expect(readState(f.root).failedTarget).toBe(state.target)
})

it('does not advance source when the profile snapshot fails', async () => {
  const f = fixture()
  await checkForkUpdate(f)
  const snapshot = async () => {
    throw new Error('SQLite snapshot remained busy')
  }
  expect((await applyForkUpdate({ ...f, snapshot })).status).toBe('failed')
  expect(readFileSync(path.join(f.root, 'app.txt'), 'utf8')).toBe('old application')
})

it('keeps the existing application usable when Git configuration cannot be read', async () => {
  const f = fixture()
  await checkForkUpdate(f)
  f.git('remote', 'remove', 'origin')
  expect((await checkForkUpdate({ ...f, force: true })).status).toBe('check-failed')
  expect((await applyForkUpdate(f)).status).toBe('check-failed')
  expect(readFileSync(path.join(f.root, 'app.txt'), 'utf8')).toBe('old application')
})

it('holds installation if the user edits source while the profile is being backed up', async () => {
  const f = fixture()
  await checkForkUpdate(f)
  const snapshot = async (root: string, profile: string, destination: string) => {
    await f.snapshot(root, profile, destination)
    writeFileSync(path.join(root, 'notes.txt'), 'my new uncommitted note')
  }
  expect((await applyForkUpdate({ ...f, snapshot })).status).toBe('failed')
  expect(readFileSync(path.join(f.root, 'notes.txt'), 'utf8')).toBe('my new uncommitted note')
  expect(readFileSync(path.join(f.root, 'app.txt'), 'utf8')).toBe('old application')
})

it('builds with the resolved package-manager entry instead of assuming a pnpm executable', async () => {
  const f = fixture()
  await checkForkUpdate(f)
  expect((await applyForkUpdate({ ...f, install: undefined })).status).toBe('current')
  expect(readFileSync(path.join(f.root, 'out/app.js'), 'utf8')).toBe('built by resolved pnpm')
  expect(readFileSync(path.join(f.root, 'out/mobile-web/manifest.json'), 'utf8')).toBe(
    '{"schemaVersion":1,"pageVersion":3}'
  )
})

it('keeps a second updater from replacing an in-progress installation record', async () => {
  const f = fixture()
  await checkForkUpdate(f)
  let release = () => {}
  const barrier = new Promise<void>((resolve) => {
    release = resolve
  })
  let signal = () => {}
  const started = new Promise<void>((resolve) => {
    signal = resolve
  })
  const snapshot = async (root: string, profile: string, destination: string) => {
    await f.snapshot(root, profile, destination)
    signal()
    await barrier
  }
  const first = applyForkUpdate({ ...f, snapshot })
  await started
  try {
    expect((await applyForkUpdate(f)).status).toBe('installing')
    expect(readState(f.root).status).toBe('installing')
    expect(readFileSync(path.join(f.root, 'app.txt'), 'utf8')).toBe('old application')
  } finally {
    release()
  }
  expect((await first).status).toBe('current')
})
