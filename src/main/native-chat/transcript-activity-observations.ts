import {
  createTranscriptHookActivity,
  type TranscriptHookObservation
} from './transcript-hook-activity'
import { isLocalHookConnectionId } from '../../shared/wsl-hook-relay-contract'

type Entry = {
  tracker: ReturnType<typeof createTranscriptHookActivity>
  receive: (row: TranscriptHookObservation) => void
}
const sessions = new Map<string, Entry>()
const listeners = new Set<(row: TranscriptHookObservation) => void>()

export function subscribeTranscriptActivityReports(
  listener: (row: TranscriptHookObservation) => void
) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function publishTranscriptActivityObservation(row: TranscriptHookObservation) {
  recordTranscriptActivityObservation(row)
  for (const listener of listeners) {
    try {
      listener(row)
    } catch {
      /* Observer failures must not affect the provider. */
    }
  }
}

export function recordTranscriptActivityObservation(row: TranscriptHookObservation): void {
  const sessionId = row.providerSession?.id ?? row.statusAdmissionSession
  if (
    !sessionId ||
    !isLocalHookConnectionId(row.connectionId) ||
    row.isReplay ||
    row.providerSessionOnly
  ) {
    return
  }
  const key = JSON.stringify([row.paneKey, sessionId])
  let entry = sessions.get(key)
  if (!entry) {
    let receive: Entry['receive'] = () => {}
    const tracker = createTranscriptHookActivity({
      paneKey: row.paneKey,
      sessionId,
      onChange: () => {},
      subscribe: (listener) => {
        receive = listener
        return () => {}
      }
    })
    entry = { tracker, receive }
    sessions.set(key, entry)
    if (sessions.size > 128) {
      sessions.delete(sessions.keys().next().value!)
    }
  }
  entry.receive(row)
}

export function readTranscriptActivityObservations(paneKey: string | undefined, sessionId: string) {
  return sessions.get(JSON.stringify([paneKey, sessionId]))?.tracker.checkpoint()
}
