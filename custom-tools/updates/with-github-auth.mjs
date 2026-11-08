import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { checkout, runProcess } from './fork-update-state.mjs'

let token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
if (!token) {
  const credential = await runProcess({
    program: 'git',
    args: ['credential', 'fill'],
    cwd: checkout,
    input: 'protocol=https\nhost=github.com\n\n',
    timeoutMs: 15000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' }
  })
  if (credential.code !== 0) {
    throw new Error('GitHub credentials are unavailable for this maintainer.')
  }
  token = credential.stdout
    .split(/\r?\n/)
    .find((line) => line.startsWith('password='))
    ?.slice(9)
  if (!token) {
    throw new Error('GitHub credential lookup returned no token.')
  }
}
const tools = path.resolve(checkout, '../.orca-local/tools')
const versionOrder = new Intl.Collator(undefined, { numeric: true })
const portable = existsSync(tools)
  ? readdirSync(tools)
      .filter((name) => /^gh-[\d.]+$/.test(name))
      .sort((a, b) => versionOrder.compare(b, a))
      .map((name) => path.join(tools, name, 'bin', process.platform === 'win32' ? 'gh.exe' : 'gh'))
      .find((file) => existsSync(file))
  : undefined
const result = await runProcess({
  program: process.env.ORCA_GH_PATH || portable || 'gh',
  args: process.argv.slice(2),
  cwd: checkout,
  env: { ...process.env, GH_TOKEN: token, GH_PAGER: 'cat' },
  stdio: 'inherit',
  timeoutMs: null
})
process.exitCode = result.code ?? 1
