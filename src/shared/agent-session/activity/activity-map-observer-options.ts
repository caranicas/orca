import {
  readActivityMapProviderOptions,
  type ActivityMapProviderOptions
} from './activity-map-provider-options'

const observers = new Map<string, Map<symbol, ActivityMapProviderOptions>>()

export function observeActivityMapOptions(
  paneKey: string | undefined,
  value: ActivityMapProviderOptions | undefined
): () => void {
  if (!paneKey) {
    return () => {}
  }
  const token = Symbol()
  const entries = observers.get(paneKey) ?? new Map<symbol, ActivityMapProviderOptions>()
  entries.set(token, readActivityMapProviderOptions(value))
  observers.set(paneKey, entries)
  return () => {
    entries.delete(token)
    if (entries.size === 0) {
      observers.delete(paneKey)
    }
  }
}

export function activityMapObserverOptions(
  paneKey: string
): ActivityMapProviderOptions | undefined {
  return [...(observers.get(paneKey)?.values() ?? [])].at(-1)
}
