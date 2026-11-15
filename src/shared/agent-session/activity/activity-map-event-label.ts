// Adapted from lot-map 09f6b93; MIT, see lot-map-LICENSE.txt.
import type { ActivityMapEvent } from './agent-activity-map'
import type { Strings } from './activity-map-text'
import { shortModel } from './activity-map-labels'

export function activityMapEventLabel(event: ActivityMapEvent, text: Strings): string {
  if (event.mark === 'prompt') {
    return text.newMessage
  }
  if (event.mark === 'done') {
    return text.answerReady
  }
  if (event.station === 'you' && event.state === 'interrupted') {
    return text.turnAborted
  }
  if (event.mark === 'compact' && (event.state === 'running' || event.state === 'completed')) {
    return text.compacting
  }
  if (event.mark === 'step') {
    const step = /^(.*) · Step (\d+)$/i.exec(event.label)
    if (step) {
      return `${shortModel(step[1])} · ${text.step(Number(step[2]))}${event.origin === 'agents' ? ` · ${text.subagent}` : ''}`
    }
  }
  return event.label
}

export function activityMapDuration(ms: number, text: Strings): string {
  return ms < 1000
    ? text.ms(Math.max(1, Math.round(ms)))
    : ms < 60000
      ? text.seconds((ms / 1000).toFixed(1))
      : text.minutes(Math.floor(ms / 60000), Math.round((ms % 60000) / 1000))
}
