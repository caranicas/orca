import { spawnSync } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import { join, normalize } from 'node:path'

// Skip .gitattributes -text binaries; SVG stays textual because CRLF changes hashed buildId. Test holds exemptions to attributes.
export const BINARY_SOURCE_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.webp',
  '.ttf',
  '.otf',
  '.woff',
  '.woff2'
]

async function listSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listSourceFiles(entryPath)))
    } else if (entry.isFile()) {
      files.push(entryPath)
    }
  }
  return files.sort()
}

// Relative paths: git can reject absolute tmp paths behind macOS's /var -> /private/var symlink.
function listGitIgnoredFiles(directory, relativeFiles) {
  const result = spawnSync('git', ['check-ignore', '-z', '--stdin'], {
    cwd: directory,
    input: relativeFiles.join('\0'),
    encoding: 'utf8'
  })
  // Exit 1 means nothing is ignored; other failures (no git, not a repo) check every file.
  if (result.status !== 0) {
    return new Set()
  }
  return new Set(result.stdout.split('\0').filter(Boolean).map(normalize))
}

// Require LF-pinned checkout: CRLF changes source bytes, asset hashes and buildId across platforms.
export async function assertNoCarriageReturnsInSource(directory) {
  const offenders = []
  const files = await listSourceFiles(directory)
  // Ignored files (e.g. Finder's .DS_Store) never reach the bundle.
  const ignored = listGitIgnoredFiles(
    directory,
    files.map((file) => file.slice(directory.length + 1))
  )
  for (const file of files) {
    const relativeFile = file.slice(directory.length + 1)
    if (ignored.has(relativeFile)) {
      continue
    }
    if (BINARY_SOURCE_EXTENSIONS.some((extension) => file.endsWith(extension))) {
      continue
    }
    // Postinstall-generated ignored source needs no git EOL pin.
    if (file.endsWith('.generated.ts')) {
      continue
    }
    if ((await readFile(file)).includes(0x0d)) {
      offenders.push(relativeFile)
    }
  }
  if (offenders.length > 0) {
    throw new Error(
      `CRLF in mobile web source, which would change every asset hash and the buildId: ` +
        `${offenders.join(', ')}. Check the .gitattributes eol=lf pin for ${directory}.`
    )
  }
}
