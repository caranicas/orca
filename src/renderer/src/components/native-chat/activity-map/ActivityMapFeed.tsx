import { useActivityMapText, useActivityMapPreferences } from './use-activity-map-preferences'
import {
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleHelp,
  Diamond,
  Pause,
  X
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { foldActivityMapFeed } from '../../../../../shared/agent-session/activity/activity-map-feed'
import type {
  ActivityMapEvent,
  ActivityMapState
} from '../../../../../shared/agent-session/activity/agent-activity-map'
import { activityMapDuration } from '../../../../../shared/agent-session/activity/activity-map-event-label'

const STATE_ICONS = {
  running: Circle,
  completed: Check,
  failed: X,
  blocked: X,
  interrupted: Pause,
  unknown: CircleHelp,
  waiting: CircleHelp,
  observed: Circle
} satisfies Record<ActivityMapState, typeof Circle>

export function ActivityMapFeed({
  events,
  hostNow,
  live
}: {
  events: readonly ActivityMapEvent[]
  hostNow: number | null
  live: boolean
}) {
  const t = useTranslate()
  const text = useActivityMapText()
  const textSize = useActivityMapPreferences((state) => state.options.textSize)
  const stateLabels = {
    running: t('components.native-chat.activityMap.state.running', 'Running'),
    completed: t('components.native-chat.activityMap.state.completed', 'Completed'),
    blocked: t('components.native-chat.activityMap.state.blocked', 'Blocked'),
    failed: t('components.native-chat.activityMap.state.failed', 'Failed'),
    interrupted: t('components.native-chat.activityMap.state.interrupted', 'Interrupted'),
    unknown: t('components.native-chat.activityMap.state.unknown', 'Unconfirmed'),
    waiting: t('components.native-chat.activityMap.state.waiting', 'Waiting for you'),
    observed: t('components.native-chat.activityMap.state.observed', 'Observed')
  }
  const [open, setOpen] = useState<string | null>(null)
  return (
    <ol className="space-y-1">
      {foldActivityMapFeed(events).map(({ event, count, durationMs }) => {
        const Icon = event.mark === 'switch' ? Diamond : STATE_ICONS[event.state]
        const expanded = open === event.id
        const expandable = event.label.length > 28
        const duration =
          durationMs ??
          (live && event.state === 'running' && hostNow !== null
            ? Math.max(0, hostNow - event.startedAt)
            : undefined)
        return (
          <li
            key={event.id}
            className={cn(
              'flex items-start gap-2',
              textSize === 'caption' ? 'text-2xs' : textSize === 'body' ? 'text-sm' : 'text-xs'
            )}
          >
            <span className="sr-only">{stateLabels[event.state]}</span>
            <Icon
              aria-hidden="true"
              className={cn(
                'mt-0.5 size-3 shrink-0',
                event.state === 'failed' || event.state === 'blocked'
                  ? 'text-destructive'
                  : event.state === 'running' || event.mark === 'switch'
                    ? 'text-activity-map-active'
                    : 'text-muted-foreground'
              )}
            />
            <div className={cn('min-w-0 flex-1 font-mono', !expanded && 'truncate')}>
              <span className="mr-2 text-muted-foreground">{text.stations[event.station]}</span>
              <span className={expanded ? 'break-words whitespace-pre-wrap' : 'truncate'}>
                {event.label}
              </span>
              {count > 1 ? <span className="ml-2 text-muted-foreground">+{count - 1}</span> : null}
            </div>
            {expandable ? (
              <Button
                variant="ghost"
                size="icon-xs"
                className="size-4 shrink-0"
                aria-label={
                  expanded
                    ? t('components.native-chat.activityMap.collapseLabel', 'Collapse label')
                    : t('components.native-chat.activityMap.expandLabel', 'Expand label')
                }
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : event.id)}
              >
                {expanded ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronRight className="size-3" />
                )}
              </Button>
            ) : null}
            <span className="w-12 shrink-0 text-right font-mono text-2xs text-muted-foreground">
              {duration === undefined
                ? '—'
                : `${event.durationEstimated ? '~' : ''}${activityMapDuration(duration, text)}`}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
