// Adapted from lot-map 09f6b93; MIT, see lot-map-LICENSE.txt.
export function activityMapTask(result: unknown): string | undefined {
  if (!result || typeof result !== 'object') {
    return undefined
  }
  const record = Object.fromEntries(Object.entries(result))
  const id = (value: unknown) =>
    typeof value === 'string' && /^[\w-]{1,64}$/.test(value) ? value : undefined
  return record.status === 'async_launched' || record.status === 'remote_launched'
    ? (id(record.agentId) ?? id(record.taskId))
    : (id(record.backgroundTaskId) ??
        (typeof record.timeoutMs === 'number' ? id(record.taskId) : undefined))
}
