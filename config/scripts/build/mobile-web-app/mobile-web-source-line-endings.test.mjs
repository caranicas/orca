import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { assertNoCarriageReturnsInSource } from './mobile-web-source-line-endings.mjs'

describe('assertNoCarriageReturnsInSource', () => {
  let scratch

  afterEach(async () => {
    await rm(scratch, { recursive: true, force: true })
  })

  it('rejects a CRLF source file, because CRLF changes every asset hash and the buildId', async () => {
    scratch = await mkdtemp(join(tmpdir(), 'orca-mobile-web-eol-'))
    await writeFile(join(scratch, 'route.tsx'), 'const a = 1\r\nconst b = 2\r\n', 'utf8')
    await expect(assertNoCarriageReturnsInSource(scratch)).rejects.toThrow(
      /CRLF in mobile web source.*: route\.tsx\./
    )
  })

  it('skips git-ignored files such as Finder metadata', async () => {
    scratch = await mkdtemp(join(tmpdir(), 'orca-mobile-web-eol-'))
    expect(spawnSync('git', ['init', '-q'], { cwd: scratch }).status).toBe(0)
    await writeFile(join(scratch, '.gitignore'), '.DS_Store\n', 'utf8')
    await writeFile(join(scratch, '.DS_Store'), 'Bud1\r\n', 'utf8')
    await writeFile(join(scratch, 'route.tsx'), 'const a = 1\n', 'utf8')
    await expect(assertNoCarriageReturnsInSource(scratch)).resolves.toBeUndefined()
  })
})
