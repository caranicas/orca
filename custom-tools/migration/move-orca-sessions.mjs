import { spawn, execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  openSync,
  closeSync,
  readFileSync,
  writeFileSync,
  renameSync,
  rmSync
} from 'node:fs'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import {
  connectRenderer,
  ORGANIZATION_KEY,
  readInstance,
  validateOrganization
} from './orca-organization-transfer.mjs'

import { repo, tools, helperDir, originalProfile } from '../orca-paths.mjs'

const migrationDir = import.meta.dirname
const custom = path.join(tools, 'profile')
const original = originalProfile
const marker = path.join(tools, 'active-profile')
const pendingPath = path.join(tools, 'pending-session-handover.json')
const appIds = ['com.stablyai.orca.dev', 'com.stablyai.orca']
const log = (message) => console.log(`[Orca handover] ${message}`)

function running(id) {
  return (
    execFileSync('/usr/bin/osascript', ['-e', `application id "${id}" is running`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15000
    }).trim() === 'true'
  )
}

async function snapshot(output, coreOnly = false) {
  await new Promise((resolve, reject) => {
    const child = spawn(
      'python3',
      [
        path.join(migrationDir, 'orca-profile-backup.py'),
        '--original',
        original,
        '--custom',
        custom,
        '--output',
        output,
        ...(coreOnly ? ['--core-only'] : [])
      ],
      {
        stdio: ['ignore', 'pipe', 'pipe']
      }
    )
    let result = ''
    let errors = ''
    child.stdout.on('data', (chunk) => {
      result += chunk
    })
    child.stderr.on('data', (chunk) => {
      errors += chunk
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Backup failed; no profile was switched. ${errors.trim()}`))
      } else {
        const audit = JSON.parse(result)
        log(
          `Backed up both profiles (${audit.original.workspacesWithSavedTabs} original workspaces with saved tabs).`
        )
        resolve()
      }
    })
  })
}

async function readOrganization() {
  const client = await connectRenderer(readInstance(repo, custom))
  try {
    return validateOrganization(
      await client.evaluate(`localStorage.getItem(${JSON.stringify(ORGANIZATION_KEY)})`)
    )
  } finally {
    client.close()
  }
}

async function waitForOriginalProfile() {
  const deadline = Date.now() + 240000
  while (Date.now() < deadline) {
    let client
    try {
      client = await connectRenderer(readInstance(repo, original))
      const ready = await client.evaluate(
        `document.readyState === 'complete' && !!document.getElementById('root')?.childElementCount`
      )
      if (ready) {
        return client
      }
    } catch {
      // The development runner writes its record before the renderer is ready.
    }
    client?.close()
    await delay(1500)
  }
  throw new Error(
    `Custom Orca did not become ready. See ${path.join(tools, 'session-handover-launch.log')}. Backups were kept; no agents were killed.`
  )
}

function readPending() {
  if (!existsSync(pendingPath)) {
    return null
  }
  const pending = JSON.parse(readFileSync(pendingPath, 'utf8'))
  const relative = path.relative(path.join(tools, 'migration-backups'), pending.backup)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Invalid pending backup location.')
  }
  const organization = validateOrganization(
    readFileSync(path.join(pending.backup, 'workspace-organization.json'), 'utf8')
  )
  return { backup: pending.backup, organization }
}

async function launchAndImport(organization, backup) {
  if (running('com.stablyai.orca')) {
    throw new Error('Quit the installed Orca with Cmd-Q before resuming this handover.')
  }
  if (!running('com.stablyai.orca.dev')) {
    log('Starting custom Orca with your original projects, settings, tabs and terminal history.')
    const logPath = path.join(tools, 'session-handover-launch.log')
    const fd = openSync(logPath, 'a', 0o600)
    const child = spawn('/bin/zsh', [path.join(helperDir, 'start-orca-custom.command')], {
      detached: true,
      stdio: ['ignore', fd, fd]
    })
    child.on('error', (error) => log(`Launch failed: ${error.message}`))
    child.unref()
    closeSync(fd)
  }
  const client = await waitForOriginalProfile()
  try {
    const old = await client.evaluate(`localStorage.getItem(${JSON.stringify(ORGANIZATION_KEY)})`)
    const savedOld = path.join(backup, 'original-organization-before-import.json')
    if (!existsSync(savedOld)) {
      writeFileSync(savedOld, JSON.stringify(old), { mode: 0o600 })
    }
    await client.evaluate(
      `localStorage.setItem(${JSON.stringify(ORGANIZATION_KEY)}, ${JSON.stringify(organization.raw)})`
    )
    const saved = await client.evaluate(`localStorage.getItem(${JSON.stringify(ORGANIZATION_KEY)})`)
    if (saved !== organization.raw) {
      throw new Error('Sidebar preference verification failed.')
    }
    await client.reload()
  } finally {
    client.close()
  }
  rmSync(pendingPath)
  log(`Handover finished. Backup: ${backup}`)
  log('Use start-orca-custom.command from now on. Leave the installed Orca closed.')
  log(
    'Check your agent tabs in custom Orca. Encrypted Orca integrations may ask you to sign in again.'
  )
}

async function main() {
  if (process.platform !== 'darwin') {
    throw new Error('This handover is for this Mac only.')
  }
  process.umask(0o077)
  const pending = readPending()
  if (existsSync(marker) && readFileSync(marker, 'utf8').trim() === 'original') {
    if (pending) {
      log('Resuming the saved sidebar preference import.')
      await launchAndImport(pending.organization, pending.backup)
      return
    }
    log('Custom Orca is already configured to use the original profile. No changes made.')
    return
  }
  log(
    'Reading your custom groups and colors. Keep both Orca windows open until this step finishes.'
  )
  const oldInstance = readInstance(repo, custom)
  const organization =
    !running('com.stablyai.orca.dev') && pending ? pending.organization : await readOrganization()
  const backup = path.join(
    tools,
    'migration-backups',
    new Date().toISOString().replaceAll(':', '-')
  )
  mkdirSync(backup, { recursive: true, mode: 0o700 })
  writeFileSync(path.join(backup, 'workspace-organization.json'), organization.raw, { mode: 0o600 })
  writeFileSync(pendingPath, JSON.stringify({ backup }), { mode: 0o600 })
  log(`Saved ${organization.groups} pinned groups and ${organization.colors} workspace colors.`)
  await snapshot(path.join(backup, 'before-quit'), true)

  log('Quitting both app windows normally. Their background terminal services are left running.')
  for (const id of appIds) {
    if (running(id)) {
      execFileSync('/usr/bin/osascript', ['-e', `tell application id "${id}" to quit`], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30000
      })
    }
  }
  const deadline = Date.now() + 45000
  while (appIds.some(running)) {
    if (Date.now() > deadline) {
      throw new Error(
        'An Orca window is still open. Quit it with Cmd-Q, then rerun. Do not use Quit Completely.'
      )
    }
    await delay(1000)
  }
  const runnerDeadline = Date.now() + 30000
  while (true) {
    try {
      process.kill(oldInstance.runnerPid, 0)
    } catch (error) {
      if (error.code === 'ESRCH') {
        break
      }
      throw new Error('Could not verify the previous development runner has stopped.')
    }
    if (Date.now() > runnerDeadline) {
      throw new Error(
        'The previous development terminal is still running. With both app windows quit, stop that terminal command and rerun this helper.'
      )
    }
    await delay(500)
  }
  await snapshot(path.join(backup, 'after-quit'))
  writeFileSync(`${marker}.tmp`, 'original\n', { mode: 0o600 })
  renameSync(`${marker}.tmp`, marker)
  await launchAndImport(organization, backup)
}

main().catch((error) => {
  console.error(`[Orca handover] Stopped: ${error.message}`)
  console.error(
    '[Orca handover] No worktrees were deleted. Keep the backup folder and share this error if you need help.'
  )
  process.exitCode = 1
})
