import { activityMapText } from './activity-map-text'
import {
  DEFAULT_ACTIVITY_MAP_CLASSIFICATION,
  type ActivityMapClassificationOptions
} from './activity-map-classification-options'

export type ActivityMapProviderOptions = {
  language: string
  memoryServers: string[]
  memoryCommands: string[]
  memorySubcommands: string[]
  memoryPaths: string[]
  memoryLabels: string[]
  hookRecords: boolean
  hookReasons: boolean
}

export const DEFAULT_ACTIVITY_MAP_PROVIDER_OPTIONS: ActivityMapProviderOptions = {
  language: 'en',
  memoryServers: ['memory'],
  memoryCommands: [],
  memorySubcommands: [],
  memoryPaths: [...DEFAULT_ACTIVITY_MAP_CLASSIFICATION.memoryPaths],
  memoryLabels: [],
  hookRecords: false,
  hookReasons: false
}

export function readActivityMapProviderOptions(value: unknown): ActivityMapProviderOptions {
  const raw = value && typeof value === 'object' ? Object.fromEntries(Object.entries(value)) : {}
  const list = (key: keyof ActivityMapProviderOptions, fallback: string[] = []) =>
    Array.isArray(raw[key])
      ? raw[key]
          .slice(0, 64)
          .filter((item): item is string => typeof item === 'string')
          .map((item) =>
            item
              .replace(/[\p{Cc}\p{Cf}]/gu, '')
              .trim()
              .slice(0, 512)
          )
          .filter(Boolean)
      : fallback
  return {
    language: typeof raw.language === 'string' ? raw.language.slice(0, 16) : 'en',
    memoryServers: list('memoryServers', DEFAULT_ACTIVITY_MAP_PROVIDER_OPTIONS.memoryServers),
    memoryCommands: list('memoryCommands'),
    memorySubcommands: list('memorySubcommands'),
    memoryPaths: list('memoryPaths', DEFAULT_ACTIVITY_MAP_PROVIDER_OPTIONS.memoryPaths),
    memoryLabels: list('memoryLabels'),
    hookRecords: raw.hookRecords === true,
    hookReasons: raw.hookReasons === true
  }
}

export function activityMapProviderClassification(
  value?: ActivityMapProviderOptions
): ActivityMapClassificationOptions {
  const options = readActivityMapProviderOptions(value)
  return {
    memoryServers: new Set(options.memoryServers),
    memoryCommands: options.memoryCommands,
    memorySubcommands: new Set(options.memorySubcommands),
    memoryPaths: options.memoryPaths,
    memoryLabels: new Map(
      options.memoryLabels.flatMap((pair) => {
        const at = pair.indexOf('=')
        return at > 0 && at < pair.length - 1
          ? [[pair.slice(0, at).trim(), pair.slice(at + 1).trim()]]
          : []
      })
    ),
    t: activityMapText(options.language)
  }
}
