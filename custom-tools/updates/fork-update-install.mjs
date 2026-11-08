import {
  closeSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  realpathSync,
  renameSync
} from 'node:fs'
import path from 'node:path'
import {
  readState,
  resolvePnpmCliInvocation,
  runProcess,
  updateDirectory
} from './fork-update-state.mjs'

export async function backupProfile(root, profile, destination) {
  if (!profile || !path.isAbsolute(profile) || !existsSync(profile)) {
    throw new Error('Select an existing profile before automatic installation.')
  }
  const result = await runProcess({
    program: process.platform === 'win32' ? 'python' : 'python3',
    args: [
      path.join(root, 'custom-tools/migration/orca-profile-backup.py'),
      '--profile',
      profile,
      '--output',
      destination
    ],
    cwd: root,
    timeoutMs: 120000,
    maxOutputBytes: 1024 * 1024
  })
  if (result.code !== 0 || !existsSync(path.join(destination, 'manifest.json'))) {
    throw new Error(`Profile snapshot did not complete: ${result.stderr.trim()}`)
  }
}

export function preserveNativeBuilds(root, directory, platform = process.platform) {
  if (platform !== 'win32') {
    return
  }
  const nativePath = path.join(root, 'native')
  if (!existsSync(nativePath)) {
    return
  }
  const native = realpathSync(nativePath)
  if (!native.startsWith(realpathSync(root) + path.sep)) {
    throw new Error('Native sources resolve outside the checkout.')
  }
  mkdirSync(directory, { recursive: true })
  const backupDirectory = realpathSync(directory)
  for (const entry of readdirSync(native, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      continue
    }
    const build = path.join(native, entry.name, 'build')
    const release = path.join(build, 'Release')
    if (
      !existsSync(release) ||
      lstatSync(build).isSymbolicLink() ||
      !readdirSync(release).some((name) => name.endsWith('.node'))
    ) {
      continue
    }
    const destination = path.resolve(backupDirectory, entry.name)
    if (
      !realpathSync(build).startsWith(native + path.sep) ||
      !destination.startsWith(backupDirectory + path.sep)
    ) {
      throw new Error('Native build preservation target is outside its expected directory.')
    }
    mkdirSync(directory, { recursive: true })
    renameSync(build, destination)
  }
}

export function preserveOutput(root, destination) {
  const source = path.join(root, 'out')
  if (existsSync(source)) {
    cpSync(source, destination, { recursive: true, verbatimSymlinks: true })
  }
}

export function restoreNativeBuilds(root, directory) {
  if (!existsSync(directory)) {
    return
  }
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      continue
    }
    const destination = path.join(root, 'native', entry.name, 'build')
    if (!existsSync(destination)) {
      renameSync(path.join(directory, entry.name), destination)
    }
  }
}

export function restoreOutput(root, source) {
  if (existsSync(source)) {
    cpSync(source, path.join(root, 'out'), { recursive: true, verbatimSymlinks: true })
  }
}

export async function verifyForkPackageManager(root) {
  const pnpm = resolvePnpmCliInvocation()
  const result = await runProcess({
    program: pnpm.command,
    args: [...pnpm.prefixArgs, '--version'],
    cwd: root,
    timeoutMs: 15000
  })
  if (result.code !== 0) {
    throw new Error(result.stderr || 'The selected pnpm command is unavailable.')
  }
}

export async function buildFork(root) {
  const env = { ...process.env, ORCA_BACKGROUND_LAUNCH: '1' }
  const pnpm = resolvePnpmCliInvocation()
  const directory = readState(root).backup ?? updateDirectory(root)
  mkdirSync(directory, { recursive: true })
  const log = path.join(directory, 'build.log')
  const fd = openSync(log, 'a', 0o600)
  try {
    for (const args of [
      ['install', '--frozen-lockfile'],
      ['-C', 'mobile', 'install', '--frozen-lockfile'],
      ['tc'],
      ['build:native'],
      ['build:desktop:assets']
    ]) {
      const result = await runProcess({
        program: pnpm.command,
        args: [...pnpm.prefixArgs, ...args],
        cwd: root,
        env,
        stdio: ['ignore', fd, fd],
        timeoutMs: null
      })
      if (result.code !== 0) {
        throw new Error(`pnpm ${args.join(' ')} failed (${result.code}). Build log: ${log}`)
      }
    }
    if (!existsSync(path.join(root, 'out/mobile-web/manifest.json'))) {
      throw new Error('The mobile workspace manifest is missing after the build.')
    }
  } finally {
    closeSync(fd)
  }
}
