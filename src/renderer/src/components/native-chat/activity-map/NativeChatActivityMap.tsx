import { Check, Circle, CircleHelp, Pause, X } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'
import { useNow } from '@/hooks/use-now'
import { cn } from '@/lib/class-names'
import { NativeChatActivityMapDiagram } from './NativeChatActivityMapDiagram'
import {
  projectAgentActivityMap,
  type ActivityMapState
} from '../../../../../shared/agent-session/activity/agent-activity-map'
import type { AgentJournalRenderItem } from '../../../../../shared/agent-session/journal/agent-session-journal-types'
import type { StructuredAgentContextUsage } from '../../../../../shared/agent-session/structured-agent-session-context-usage'
import type { StructuredAgentSubagentRoster } from '../../../../../shared/agent-session/view/structured-agent-session-subagent-roster'
import { formatToolDuration } from '../../../../../shared/native-chat/tools/native-chat-tool-identity'
import type { StructuredAgentHostClock } from '../../../../../shared/agent-session/structured-agent-session-reducer'

const STATE_ICONS = {
  running: Circle,
  completed: Check,
  failed: X,
  interrupted: Pause,
  unknown: CircleHelp,
  waiting: CircleHelp,
  observed: Circle
} satisfies Record<ActivityMapState, typeof Circle>

export function NativeChatActivityMap({
  items,
  agentLabel,
  working,
  live,
  hostClock,
  contextUsage,
  subagentRoster,
  onClose
}: {
  items: readonly AgentJournalRenderItem[]
  agentLabel: string
  working: boolean
  live: boolean
  hostClock?: StructuredAgentHostClock | null
  contextUsage: StructuredAgentContextUsage | null
  subagentRoster: StructuredAgentSubagentRoster
  onClose: () => void
}) {
  const t = useTranslate()
  const stateLabels = {
    running: t('components.native-chat.activityMap.state.running', 'Running'),
    completed: t('components.native-chat.activityMap.state.completed', 'Completed'),
    failed: t('components.native-chat.activityMap.state.failed', 'Failed'),
    interrupted: t('components.native-chat.activityMap.state.interrupted', 'Interrupted'),
    unknown: t('components.native-chat.activityMap.state.unknown', 'Unconfirmed'),
    waiting: t('components.native-chat.activityMap.state.waiting', 'Waiting for you'),
    observed: t('components.native-chat.activityMap.state.observed', 'Observed')
  }
  const events = useMemo(() => projectAgentActivityMap(items), [items])
  const active = events.filter((event) => event.state === 'running' || event.state === 'waiting')
  const now = useNow(1000, live && active.length > 0)
  const hostNow = hostClock ? hostClock.hostNow + now - hostClock.receivedAt : null
  const activeIds = new Set(active.map((event) => event.id))
  const recent = [
    ...active,
    ...events.filter((event) => !activeIds.has(event.id)).toReversed()
  ].slice(0, 16)
  const workingAgents = [...subagentRoster.values()].filter(
    ({ entry }) => entry.state === 'working'
  ).length
  return (
    <aside
      aria-label={t('components.native-chat.activityMap.title', 'Activity map')}
      data-native-chat-activity-map=""
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
      className="flex h-full min-h-0 flex-col bg-card text-card-foreground"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-xs font-semibold">
          {t('components.native-chat.activityMap.title', 'Activity map')}
        </h2>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t('components.native-chat.activityMap.close', 'Close activity map')}
          onClick={onClose}
        >
          <X className="size-3.5" />
        </Button>
      </div>
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
        <NativeChatActivityMapDiagram
          events={events}
          agentLabel={agentLabel}
          working={working}
          live={live}
          contextPercent={contextUsage?.percentage}
          workingAgents={workingAgents}
        />
        <div className="space-y-3 px-3 pb-3">
          {contextUsage ? (
            <p className="text-xs text-muted-foreground">
              {t('components.native-chat.activityMap.context', '{{percent}}% context used', {
                percent: contextUsage.percentage
              })}
              {contextUsage.estimated
                ? ` · ${t('components.native-chat.activityMap.estimated', 'estimated')}`
                : ''}
            </p>
          ) : null}
          {!live ? (
            <p role="status" className="text-xs text-muted-foreground">
              {t('components.native-chat.activityMap.offline', 'Waiting for session updates')}
            </p>
          ) : null}
          {workingAgents > 0 ? (
            <p className="text-xs text-muted-foreground">
              {t(
                'components.native-chat.activityMap.workingAgents',
                'Subagents working: {{count}}',
                { count: workingAgents }
              )}
            </p>
          ) : null}
          <h3 className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('components.native-chat.activityMap.recent', 'Recent activity')}
          </h3>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t(
                'components.native-chat.activityMap.empty',
                'Send a message to see activity here.'
              )}
            </p>
          ) : (
            <ol className="space-y-2">
              {recent.map((event) => {
                const Icon = STATE_ICONS[event.state]
                const duration =
                  event.durationMs ??
                  (live && event.state === 'running' && hostNow !== null
                    ? Math.max(0, hostNow - event.startedAt)
                    : undefined)
                return (
                  <li key={event.id} className="flex items-start gap-2 text-sm">
                    <span className="sr-only">{stateLabels[event.state]}</span>
                    <Icon
                      aria-hidden="true"
                      className={cn(
                        'mt-0.5 size-3.5 shrink-0',
                        event.state === 'failed' ? 'text-destructive' : 'text-muted-foreground'
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-xs">{event.label}</div>
                      <div className="text-2xs text-muted-foreground">
                        {t(
                          `components.native-chat.activityMap.station.${event.station}`,
                          event.station
                        )}
                        {event.origin === 'agents'
                          ? ` · ${t('components.native-chat.activityMap.subagent', 'subagent')}`
                          : ''}
                      </div>
                    </div>
                    {duration !== undefined ? (
                      <span className="shrink-0 font-mono text-2xs text-muted-foreground">
                        {formatToolDuration(duration)}
                      </span>
                    ) : null}
                  </li>
                )
              })}
            </ol>
          )}
          <p className="text-2xs text-muted-foreground">
            {t(
              'components.native-chat.activityMap.loaded',
              'Based on loaded activity. Shell scripts stay in Shell; unreported activity is omitted.'
            )}
          </p>
        </div>
      </div>
    </aside>
  )
}
