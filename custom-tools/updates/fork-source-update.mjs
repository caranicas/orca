import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  checkout,
  config,
  desktopIsRunning,
  git,
  normalizeRepository,
  readState,
  updateDirectory,
  writeState
} from './fork-update-state.mjs'
import {
  backupProfile,
  buildFork,
  preserveNativeBuilds,
  preserveOutput,
  restoreNativeBuilds,
  restoreOutput
} from './fork-update-install.mjs'

export async function eligibleCheckout(root, settings = config) {
  const marker = path.join(root, '.git')
  if (!existsSync(marker) || !lstatSync(marker).isDirectory()) {
    return 'Automatic updates use a primary Git checkout.'
  }
  const branch = await git(root, ['branch', '--show-current'])
  if (branch.text !== settings.branch) {
    return `Automatic updates wait for branch ${settings.branch}.`
  }
  const remote = await git(root, ['config', '--get', 'remote.origin.url'])
  if (
    normalizeRepository(remote.text) !==
    normalizeRepository(`https://github.com/${settings.repository}`)
  ) {
    return 'The origin remote does not match this fork.'
  }
  return null
}

export async function checkForkUpdate({ root = checkout, settings = config, force = false } = {}) {
  const state = readState(root)
  if (state.status === 'installing' || state.status === 'recovery-required') {
    return state
  }
  if (state.enabled === false) {
    return state
  }
  if (!force && Date.now() - (state.lastCheckedAt ?? 0) < settings.intervalHours * 3600000) {
    return state
  }
  const held = await eligibleCheckout(root, settings)
  if (held) {
    return writeState(root, { status: 'held', reason: held, lastAttemptAt: Date.now() })
  }
  try {
    await git(root, [
      'fetch',
      '--no-tags',
      'origin',
      `refs/heads/${settings.branch}:refs/remotes/origin/${settings.branch}`
    ])
    const head = (await git(root, ['rev-parse', 'HEAD'])).text
    const target = (await git(root, ['rev-parse', `refs/remotes/origin/${settings.branch}`])).text
    const ancestor = await git(root, ['merge-base', '--is-ancestor', head, target], {
      allowFailure: true
    })
    if (ancestor.code !== 0) {
      return writeState(root, {
        lastCheckedAt: Date.now(),
        status: 'held',
        reason: 'Local commits diverge from fork main.'
      })
    }
    return writeState(root, {
      lastCheckedAt: Date.now(),
      target,
      status:
        head === target
          ? 'current'
          : state.failedTarget === target && !force
            ? 'failed'
            : 'pending',
      reason: state.failedTarget === target && !force ? state.reason : null,
      lastAttemptAt: Date.now(),
      ...(force ? { failedTarget: null } : {})
    })
  } catch (error) {
    return writeState(root, {
      status: 'check-failed',
      reason: error.message,
      lastAttemptAt: Date.now()
    })
  }
}

export async function applyForkUpdate({
  root = checkout,
  settings = config,
  profile = process.env.ORCA_DEV_USER_DATA_PATH,
  install = buildFork,
  snapshot = backupProfile
} = {}) {
  const state = readState(root)
  if (state.status === 'installing' || state.status === 'recovery-required') {
    return writeState(root, {
      status: 'recovery-required',
      reason: 'An interrupted installation needs recovery from its retained backup.'
    })
  }
  if (state.enabled === false || !state.target || state.failedTarget === state.target) {
    return state
  }
  if (!/^[a-f0-9]{40}$/.test(state.target)) {
    throw new Error('Invalid pending update commit')
  }
  const previous = (await git(root, ['rev-parse', 'HEAD'])).text
  if (previous === state.target) {
    return writeState(root, { status: 'current', installedCommit: previous })
  }
  const held = await eligibleCheckout(root, settings)
  if (held) {
    return writeState(root, { status: 'held', reason: held })
  }
  if (desktopIsRunning(root)) {
    return writeState(root, {
      status: 'pending',
      reason: 'Installation waits for normal desktop close.'
    })
  }
  if (!profile || !path.isAbsolute(profile) || !existsSync(profile)) {
    return writeState(root, {
      status: 'held',
      reason: 'Installation waits for an existing selected profile.'
    })
  }
  if ((await git(root, ['status', '--porcelain=v1', '--untracked-files=all'])).text) {
    return writeState(root, {
      status: 'held',
      reason: 'Save or commit local source changes before installation.'
    })
  }
  const ancestor = await git(root, ['merge-base', '--is-ancestor', previous, state.target], {
    allowFailure: true
  })
  if (ancestor.code !== 0) {
    return writeState(root, { status: 'held', reason: 'The update is not a fast-forward.' })
  }
  const directory = updateDirectory(root)
  mkdirSync(directory, { recursive: true })
  const lock = path.join(directory, 'install.lock')
  try {
    writeFileSync(lock, String(process.pid), { flag: 'wx', mode: 0o600 })
  } catch (error) {
    if (error.code === 'EEXIST') {
      const owner = Number(readFileSync(lock, 'utf8'))
      if (Number.isSafeInteger(owner) && owner > 0) {
        try {
          process.kill(owner, 0)
        } catch (probeError) {
          if (probeError.code === 'ESRCH') {
            rmSync(lock)
            return applyForkUpdate({ root, settings, profile, install, snapshot })
          }
        }
      }
      return writeState(root, { status: 'held', reason: 'Another update holds the install lock.' })
    }
    throw error
  }
  const backup = path.join(directory, `backup-${Date.now()}`)
  const output = path.join(backup, 'out')
  let activated = false
  try {
    writeState(root, { status: 'installing', backup, previousCommit: previous })
    console.log(
      '[Orca updates] Updating after normal close. Keep the launcher open until this finishes.'
    )
    mkdirSync(backup)
    await snapshot(root, profile, path.join(backup, 'profile'))
    preserveOutput(root, output)
    await git(root, ['branch', `backup/fork-update-${Date.now()}`, previous])
    preserveNativeBuilds(root, path.join(backup, 'native'))
    await git(root, ['merge', '--ff-only', '--no-edit', state.target])
    activated = true
    await install(root)
    console.log('[Orca updates] Update complete. Reopen Orca normally when ready.')
    return writeState(root, {
      status: 'current',
      installedCommit: state.target,
      installedAt: Date.now(),
      backup,
      failedTarget: null,
      reason: null
    })
  } catch (error) {
    if (!activated) {
      restoreNativeBuilds(root, path.join(backup, 'native'))
    }
    if (activated) {
      try {
        await git(root, ['reset', '--keep', previous])
        await install(root)
        restoreOutput(root, output)
      } catch (rollbackError) {
        writeState(root, {
          status: 'recovery-required',
          backup,
          reason: `${error.message}; rollback: ${rollbackError.message}`,
          failedTarget: state.target
        })
        throw new Error(
          `Update recovery needs attention. Backup: ${backup}. ${rollbackError.message}`
        )
      }
    }
    return writeState(root, {
      status: 'failed',
      backup,
      failedTarget: state.target,
      reason: error.message
    })
  } finally {
    rmSync(lock)
  }
}

export async function upstreamCheck(root = checkout) {
  await git(root, [
    'fetch',
    '--no-tags',
    'origin',
    `refs/heads/${config.branch}:refs/remotes/origin/${config.branch}`
  ])
  await git(root, ['fetch', '--no-tags', config.upstream, config.upstreamBranch])
  const main = (await git(root, ['rev-parse', `refs/remotes/origin/${config.branch}`])).text
  const result = await git(root, ['merge-base', '--is-ancestor', 'FETCH_HEAD', main], {
    allowFailure: true
  })
  if (result.code > 1) {
    throw new Error(result.stderr)
  }
  return result.code === 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const command = process.argv[2] ?? 'status'
  try {
    let result
    if (command === 'check') {
      result = await checkForkUpdate({ force: process.argv.includes('--force') })
    } else if (command === 'apply') {
      result = await applyForkUpdate()
    } else if (command === 'upstream-check') {
      process.exitCode = (await upstreamCheck()) ? 0 : 1
    } else if (command === 'enable' || command === 'disable') {
      result = writeState(checkout, { enabled: command === 'enable' })
    } else if (command === 'status') {
      result = readState(checkout)
    } else {
      throw new Error(`Unknown fork update command: ${command}`)
    }
    if (result) {
      console.log(JSON.stringify(result, null, 2))
    }
    if (['failed', 'check-failed', 'recovery-required'].includes(result?.status)) {
      process.exitCode = 1
    }
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
