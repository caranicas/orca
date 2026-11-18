import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { ActivityMapEvent } from '../../../../../shared/agent-session/activity/agent-activity-map'
import { shortModel } from '../../../../../shared/agent-session/activity/activity-map-labels'

type ModelReport = { sessionId: string; model: string; at: number }
function readFolders(saved: unknown): Record<string, ModelReport> {
  const state = saved && typeof saved === 'object' ? Object.fromEntries(Object.entries(saved)) : {}
  const folders =
    state.folders && typeof state.folders === 'object'
      ? Object.entries(state.folders).slice(-128)
      : []
  return Object.fromEntries(
    folders.flatMap(([key, value]): [string, ModelReport][] => {
      const row =
        value && typeof value === 'object' ? Object.fromEntries(Object.entries(value)) : {}
      return key.length <= 8192 &&
        typeof row.sessionId === 'string' &&
        row.sessionId.length <= 256 &&
        typeof row.model === 'string' &&
        row.model.length <= 256 &&
        typeof row.at === 'number' &&
        Number.isFinite(row.at)
        ? [[key, { sessionId: row.sessionId, model: row.model, at: row.at }]]
        : []
    })
  )
}
const useModelHistory = create<{
  folders: Record<string, ModelReport>
  remember: (key: string, report: ModelReport) => void
}>()(
  persist(
    (set) => ({
      folders: {},
      remember: (key, report) =>
        set((state) => ({
          folders: Object.fromEntries(
            [
              ...Object.entries(state.folders).filter(([folder]) => folder !== key),
              [key, report]
            ].slice(-128)
          )
        }))
    }),
    {
      name: 'orca.activity-map-models.v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ folders: state.folders }),
      merge: (saved, current) => ({ ...current, folders: readFolders(saved) })
    }
  )
)

export function useActivityMapModelHistory(input: {
  host?: string | null
  cwd?: string
  provider: string
  sessionId: string | null
  model?: string | null
  at?: number
  withinSession?: boolean
}): ActivityMapEvent | undefined {
  const { host, cwd, provider, sessionId, model, at, withinSession = false } = input
  const source = JSON.stringify([host, cwd, provider, sessionId])
  const [change, setChange] = useState<{ source: string; event: ActivityMapEvent }>()
  useEffect(() => {
    if (!cwd || !sessionId || !model || !at) {
      return
    }
    const key = JSON.stringify([host ?? 'local', provider, cwd])
    const history = useModelHistory.getState()
    const before = history.folders[key]
    if (before && before.at >= at) {
      return
    }
    if (before && (withinSession || before.sessionId !== sessionId) && before.model !== model) {
      setChange({
        source,
        event: {
          id: `folder-model:${sessionId}:${at}`,
          station: 'model',
          origin: 'core',
          state: 'observed',
          label: `${shortModel(before.model)} → ${shortModel(model)}`,
          startedAt: at,
          mark: 'switch'
        }
      })
    }
    history.remember(key, { sessionId, model, at })
  }, [host, cwd, provider, sessionId, model, at, withinSession, source])
  return change?.source === source ? change.event : undefined
}
