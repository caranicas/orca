import { useMemo } from 'react'
import {
  readActivityMapProviderOptions,
  DEFAULT_ACTIVITY_MAP_PROVIDER_OPTIONS,
  type ActivityMapProviderOptions
} from '../../../../../shared/agent-session/activity/activity-map-provider-options'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { useIntlLocale } from '@/i18n/use-translate'
import { activityMapText } from '../../../../../shared/agent-session/activity/activity-map-text'

export type ActivityMapPreferences = ActivityMapProviderOptions & {
  colors: string[]
  coreName: string
  language: string
  layout: 'you-top' | 'you-bottom'
  motion: 'full' | 'reduced'
  theme: 'auto' | 'light' | 'dark'
  background: 'solid' | 'transparent'
  textSize: 'caption' | 'footnote' | 'body'
  minimized: boolean
  zoom: number | null
}

const DEFAULTS: ActivityMapPreferences = {
  ...DEFAULT_ACTIVITY_MAP_PROVIDER_OPTIONS,
  colors: [],
  coreName: '',
  language: 'auto',
  layout: 'you-top',
  motion: 'full',
  theme: 'auto',
  background: 'solid',
  textSize: 'footnote',
  minimized: false,
  zoom: null
}

function readPreferences(value: unknown): ActivityMapPreferences {
  const raw = value && typeof value === 'object' ? Object.fromEntries(Object.entries(value)) : {}
  return {
    ...readActivityMapProviderOptions(raw),
    colors: Array.isArray(raw.colors)
      ? raw.colors
          .filter((color): color is string => typeof color === 'string')
          .slice(0, 13)
          .map((color) => color.slice(0, 64))
      : [],
    coreName: typeof raw.coreName === 'string' ? raw.coreName.slice(0, 10) : '',
    language:
      typeof raw.language === 'string' &&
      ['auto', 'en', 'ru', 'es', 'fr', 'de', 'it', 'pt'].includes(raw.language)
        ? raw.language
        : 'auto',
    layout: raw.layout === 'you-bottom' ? 'you-bottom' : 'you-top',
    motion: raw.motion === 'reduced' ? 'reduced' : 'full',
    theme: raw.theme === 'light' || raw.theme === 'dark' ? raw.theme : 'auto',
    background: raw.background === 'transparent' ? 'transparent' : 'solid',
    textSize: raw.textSize === 'caption' || raw.textSize === 'body' ? raw.textSize : 'footnote',
    minimized: raw.minimized === true,
    zoom:
      typeof raw.zoom === 'number' && [160, 200, 240, 280, 340, 400].includes(raw.zoom)
        ? raw.zoom
        : null
  }
}

export const useActivityMapPreferences = create<{
  options: ActivityMapPreferences
  update: (patch: Partial<ActivityMapPreferences>) => void
}>()(
  persist(
    (set) => ({
      options: DEFAULTS,
      update: (patch) =>
        set((state) => ({ options: readPreferences({ ...state.options, ...patch }) }))
    }),
    {
      name: 'orca.activity-map.v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ options: state.options }),
      merge: (saved, current) => {
        const raw =
          saved && typeof saved === 'object' ? Object.fromEntries(Object.entries(saved)) : {}
        return { ...current, options: readPreferences(raw.options) }
      }
    }
  )
)

export function useActivityMapText() {
  const locale = useIntlLocale()
  const language = useActivityMapPreferences((state) => state.options.language)
  return activityMapText(language === 'auto' ? locale : language)
}

export function useActivityMapProviderOptions(): ActivityMapProviderOptions {
  const locale = useIntlLocale()
  const serialized = useActivityMapPreferences((state) =>
    JSON.stringify({
      ...readActivityMapProviderOptions(state.options),
      language: state.options.language === 'auto' ? locale : state.options.language
    })
  )
  return useMemo(() => readActivityMapProviderOptions(JSON.parse(serialized)), [serialized])
}
