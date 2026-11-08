import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

export const checkout = path.resolve(import.meta.dirname, '../..')
const require = createRequire(path.join(checkout, 'package.json'))
export const { runProcess, spawnProcess } = require('@orca/process-host')
export const config = JSON.parse(
  readFileSync(path.join(import.meta.dirname, 'fork-update-config.json'), 'utf8')
)

export function updateDirectory(root) {
  const resolved = path.resolve(root)
  const key = createHash('sha256')
    .update(process.platform === 'win32' ? resolved.toLowerCase() : resolved)
    .digest('hex')
    .slice(0, 12)
  return path.join(path.dirname(root), '.orca-local', 'updates', key)
}

export function readState(root) {
  const file = path.join(updateDirectory(root), 'state.json')
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
}

export function writeState(root, patch) {
  const directory = updateDirectory(root)
  mkdirSync(directory, { recursive: true })
  const state = { ...readState(root), ...patch }
  const temporary = path.join(directory, `state-${process.pid}.tmp`)
  writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 })
  renameSync(temporary, path.join(directory, 'state.json'))
  return state
}

export async function git(root, args, { allowFailure = false } = {}) {
  const result = await runProcess({
    program: 'git',
    args,
    cwd: root,
    maxOutputBytes: 64 * 1024 * 1024,
    timeoutMs: 120000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' }
  })
  if (result.code !== 0 && !allowFailure) {
    throw new Error(result.stderr.trim() || `git ${args[0]} failed`)
  }
  return { ...result, text: result.stdout.trim() }
}

export function desktopIsRunning(root) {
  const file = path.join(root, 'out/dev-instance.json')
  if (!existsSync(file)) {
    return false
  }
  const { runnerPid } = JSON.parse(readFileSync(file, 'utf8'))
  if (!Number.isSafeInteger(runnerPid) || runnerPid <= 0) {
    throw new Error('Invalid desktop runner record')
  }
  try {
    process.kill(runnerPid, 0)
    return true
  } catch (error) {
    if (error.code === 'ESRCH') {
      return false
    }
    throw error
  }
}

export function normalizeRepository(value) {
  return value
    .trim()
    .replace(/^git@github\.com:/i, 'https://github.com/')
    .replace(/^ssh:\/\/git@github\.com\//i, 'https://github.com/')
    .replace(/\.git\/?$/i, '')
    .replace(/\/$/, '')
    .toLowerCase()
}
