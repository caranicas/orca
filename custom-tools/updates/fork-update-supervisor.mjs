import { checkout, config, readState, runProcess } from './fork-update-state.mjs'
import { applyForkUpdate, checkForkUpdate } from './fork-source-update.mjs'

let reported = ''
function report(state) {
  const signature = JSON.stringify([state.status, state.reason, state.target])
  if (signature === reported) {
    return
  }
  reported = signature
  if (state.status && state.status !== 'current') {
    console.log(
      `[Orca updates] ${state.status}: ${state.reason ?? 'A validated fork update will install after normal close.'}`
    )
  }
  if (state.status === 'recovery-required') {
    throw new Error(`Restore the retained update backup before launching: ${state.backup}`)
  }
}

try {
  report(await checkForkUpdate())
  report(await applyForkUpdate())
  let checking = Promise.resolve()
  let timer
  let stopped = false
  const arm = () => {
    if (stopped) {
      return
    }
    const state = readState(checkout)
    const due =
      state.status === 'check-failed' || !state.lastCheckedAt
        ? (state.lastAttemptAt ?? Date.now()) + 3600000
        : state.lastCheckedAt + config.intervalHours * 3600000
    const delay = Math.max(60000, Math.min(3600000, due - Date.now()))
    timer = setTimeout(() => {
      checking = checkForkUpdate()
        .then(report)
        .catch((error) => console.error(`[Orca updates] ${error.message}`))
        .finally(arm)
    }, delay)
    timer.unref()
  }
  arm()
  const result = await runProcess({
    program: 'pnpm',
    args: ['dev'],
    cwd: checkout,
    stdio: 'inherit',
    timeoutMs: null
  })
  stopped = true
  clearTimeout(timer)
  await checking
  if (result.code === 0) {
    report(await applyForkUpdate())
  }
  process.exitCode = result.code ?? 1
} catch (error) {
  console.error(`[Orca updates] ${error.message}`)
  process.exitCode = 1
}
