import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  checkout as defaultCheckout,
  config,
  runProcess,
  writeState
} from './fork-update-state.mjs'
import { eligibleCheckout } from './fork-source-update.mjs'

const checkoutFlag = process.argv.indexOf('--checkout')
if (checkoutFlag !== -1 && !process.argv[checkoutFlag + 1]) {
  throw new Error('--checkout needs a primary checkout path.')
}
const checkout =
  checkoutFlag !== -1 ? path.resolve(process.argv[checkoutFlag + 1]) : defaultCheckout
const held = await eligibleCheckout(checkout)
if (held) {
  throw new Error(held)
}

const metadata = JSON.parse(readFileSync(path.join(checkout, 'package.json'), 'utf8'))
const profile =
  process.env.ORCA_DEV_USER_DATA_PATH ??
  JSON.parse(readFileSync(path.join(checkout, 'out/dev-instance.json'), 'utf8')).userData
if (!profile || !path.isAbsolute(profile)) {
  throw new Error('Select the maintainer Orca profile first.')
}
const env = { ...process.env, ORCA_DEV_REPO_ROOT: checkout, ORCA_DEV_USER_DATA_PATH: profile }
async function orca(args) {
  const reply = await runProcess({
    program: process.execPath,
    args: [path.resolve(checkout, metadata.bin['orca-dev']), ...args, '--json'],
    cwd: checkout,
    env,
    timeoutMs: 60000,
    maxOutputBytes: 4 * 1024 * 1024
  })
  if (reply.code !== 0) {
    throw new Error(reply.stderr || reply.stdout)
  }
  const data = JSON.parse(reply.stdout)
  if (!data.ok) {
    throw new Error(JSON.stringify(data.error))
  }
  return data.result
}

const name = 'Orca fork upstream maintenance'
const current = (await orca(['automations', 'list'])).automations.filter(
  (item) => item.name === name
)
if (current.length > 1) {
  throw new Error('Multiple fork maintenance automations exist; choose one before changing them.')
}
if (!current.length) {
  const listed = await orca(['repo', 'list'])
  const repos = listed.repos ?? listed.items ?? []
  if (!repos.some((repo) => path.resolve(repo.path).toLowerCase() === checkout.toLowerCase())) {
    await orca(['repo', 'add', '--path', checkout])
  }
}
const prompt = `Use $orca-fork-update by reading custom-tools/skills/orca-fork-update/SKILL.md in this checkout. This is the authorized recurring maintainer job for ${config.repository}. Check ${config.upstream} ${config.upstreamBranch}; when updates exist, integrate them in an isolated branch, resolve conflicts while preserving the custom features, run focused tests and required checks, publish/update one PR, watch the exact SHA and merge with full ancestry only after the required aggregate gate passes. Audit associated issues. Do not bypass hooks or gates. Leave unresolved failures pending with a clear report rather than repeatedly trying or altering unrelated features. After merge, queue desktop delivery by running the check command in the primary installation at ${checkout}. Do not close the user's running desktop or stop any terminal daemon; its launcher installs the validated fork main after normal close. If permission or credentials are unavailable, report that blocker without changing permission settings. Read references/automation.md in the skill for operational lessons.`
const script = path.join(checkout, 'custom-tools/updates/fork-source-update.mjs')
const flags = [
  '--name',
  name,
  '--trigger',
  'FREQ=DAILY;INTERVAL=3;BYHOUR=9;BYMINUTE=0',
  '--timezone',
  Intl.DateTimeFormat().resolvedOptions().timeZone,
  '--missed-run-grace-minutes',
  '4320',
  '--provider',
  'codex',
  '--prompt',
  prompt,
  '--precheck',
  `"${process.execPath}" "${script}" upstream-check`,
  '--precheck-timeout',
  '120',
  process.argv.includes('--disabled') ? '--disabled' : '--enabled'
]
const result = current.length
  ? await orca(['automations', 'edit', current[0].id, ...flags])
  : await orca([
      'automations',
      'create',
      ...flags,
      '--repo',
      `path:${checkout}`,
      '--workspace-mode',
      'new-per-run',
      '--base-branch',
      config.branch,
      '--setup',
      'skip'
    ])
const automation = result.automation ?? result
writeState(checkout, {
  maintainerAutomationId: automation.id ?? current[0]?.id,
  maintainerProfile: profile
})
console.log(
  JSON.stringify(
    {
      name,
      id: automation.id ?? current[0]?.id,
      schedule: 'Every 3 days at 09:00',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    null,
    2
  )
)
