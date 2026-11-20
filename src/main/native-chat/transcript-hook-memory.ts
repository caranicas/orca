import { asRecord } from '../ai-vault/parsing/session-record-fields'
import { extractString } from '../../shared/text/trimmed-string'
import type { ActivityMapEvent } from '../../shared/agent-session/activity/agent-activity-map'
import { activityMapText } from '../../shared/agent-session/activity/activity-map-text'

export function transcriptHookMemory(
  item: Record<string, unknown> | null,
  base: ActivityMapEvent,
  language: string
): ActivityMapEvent | undefined {
  if (item?.type !== 'HookPrompt' || !Array.isArray(item.fragments)) {
    return undefined
  }
  const ids = new Set<string>()
  for (const fragment of item.fragments) {
    const text = extractString(asRecord(fragment)?.text) ?? ''
    for (const match of text.matchAll(/\[(?:[a-z]+ )?#(\d{1,24})\b/g)) {
      ids.add(match[1])
    }
  }
  return ids.size
    ? {
        ...base,
        id: `${base.id}:pushed-memory`,
        station: 'memory',
        state: 'observed',
        mark: undefined,
        inbound: true,
        label: activityMapText(language).records(
          ids.size,
          [...ids]
            .slice(0, 6)
            .map((id) => `#${id}`)
            .join(' ') + (ids.size > 6 ? ' …' : '')
        )
      }
    : undefined
}
