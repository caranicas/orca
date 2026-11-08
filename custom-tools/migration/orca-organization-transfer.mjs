import { readFileSync, realpathSync } from 'node:fs'

export const ORGANIZATION_KEY = 'orca.workspace-organization.v1'

export function validateOrganization(raw) {
  if (typeof raw !== 'string' || raw.length > 2_000_000) {
    throw new Error('Custom sidebar preferences could not be read; nothing was switched.')
  }
  const value = JSON.parse(raw)
  const grouping = value?.state?.grouping
  if (
    value?.version !== 0 ||
    !Array.isArray(grouping?.groups) ||
    !grouping.memberships ||
    typeof grouping.memberships !== 'object' ||
    !value.state.colors ||
    typeof value.state.colors !== 'object'
  ) {
    throw new Error('Unrecognized sidebar preferences; nothing was switched.')
  }
  const ids = new Set()
  for (const group of grouping.groups) {
    if (
      typeof group?.id !== 'string' ||
      !group.id ||
      typeof group.name !== 'string' ||
      !group.name.trim() ||
      ids.has(group.id)
    ) {
      throw new Error('Invalid pinned group preferences.')
    }
    ids.add(group.id)
  }
  if (
    Array.isArray(grouping.memberships) ||
    Array.isArray(value.state.colors) ||
    Object.values(grouping.memberships).some((id) => !ids.has(id)) ||
    Object.values(value.state.colors).some((color) => !/^#[\da-f]{6}$/i.test(color))
  ) {
    throw new Error('Invalid workspace color or membership preferences.')
  }
  return { raw, groups: grouping.groups.length, colors: Object.keys(value.state.colors).length }
}

export function readInstance(repoRoot, expectedProfile) {
  const record = JSON.parse(readFileSync(`${repoRoot}/out/dev-instance.json`, 'utf8'))
  if (!Number.isSafeInteger(record.runnerPid) || record.runnerPid <= 1) {
    throw new Error('Invalid development runner identity.')
  }
  if (
    realpathSync(record.repoRoot) !== realpathSync(repoRoot) ||
    realpathSync(record.userData) !== realpathSync(expectedProfile)
  ) {
    throw new Error('The running custom app uses an unexpected profile.')
  }
  const cdp = new URL(record.cdpUrl)
  const renderer = new URL(record.rendererUrl)
  if (
    cdp.protocol !== 'http:' ||
    !['localhost', '127.0.0.1'].includes(cdp.hostname) ||
    Number(cdp.port) !== record.cdpPort ||
    renderer.protocol !== 'http:' ||
    !['localhost', '127.0.0.1'].includes(renderer.hostname)
  ) {
    throw new Error('Invalid local development connection.')
  }
  return record
}

export function selectRenderer(targets, record) {
  const origin = new URL(record.rendererUrl).origin
  const matches = targets.filter((target) => {
    try {
      return target.type === 'page' && new URL(target.url).origin === origin
    } catch {
      return false
    }
  })
  if (matches.length !== 1) {
    throw new Error('Expected one custom Orca renderer. Keep its main window open.')
  }
  const target = matches[0]
  const websocket = new URL(target.webSocketDebuggerUrl)
  if (
    websocket.protocol !== 'ws:' ||
    !['localhost', '127.0.0.1'].includes(websocket.hostname) ||
    Number(websocket.port) !== record.cdpPort
  ) {
    throw new Error('Invalid renderer debugger connection.')
  }
  return target
}

export async function connectRenderer(record) {
  const response = await fetch(new URL('/json/list', record.cdpUrl), {
    signal: AbortSignal.timeout(4000)
  })
  if (!response.ok) {
    throw new Error('Could not connect to custom Orca.')
  }
  const target = selectRenderer(await response.json(), record)
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.close()
      reject(new Error('Debugger connection timed out.'))
    }, 5000)
    socket.addEventListener(
      'open',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true }
    )
    socket.addEventListener(
      'error',
      () => {
        clearTimeout(timer)
        reject(new Error('Debugger connection failed.'))
      },
      { once: true }
    )
  })
  let nextId = 1
  const pending = new Map()
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    const entry = pending.get(message.id)
    if (!entry) {
      return
    }
    clearTimeout(entry.timer)
    pending.delete(message.id)
    if (message.error) {
      entry.reject(new Error('Renderer debugger request failed.'))
    } else {
      entry.resolve(message.result)
    }
  })
  socket.addEventListener('close', () => {
    for (const entry of pending.values()) {
      clearTimeout(entry.timer)
      entry.reject(new Error('Renderer connection closed.'))
    }
    pending.clear()
  })
  const request = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error('Renderer request timed out.'))
      }, 8000)
      pending.set(id, { resolve, reject, timer })
      socket.send(JSON.stringify({ id, method, params }))
    })
  return {
    close: () => socket.close(),
    reload: () => request('Page.reload'),
    async evaluate(expression) {
      const result = await request('Runtime.evaluate', { expression, returnByValue: true })
      if (result.exceptionDetails) {
        throw new Error('Sidebar preference request failed.')
      }
      return result.result.value
    }
  }
}
