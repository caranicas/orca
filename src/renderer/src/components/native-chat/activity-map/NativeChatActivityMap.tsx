import { mergeTerminalActivity } from '../../../../../shared/agent-session/activity/merge-terminal-activity'
import { activityMapColors } from './activity-map-colors'
import { activityMapEventLabel } from '../../../../../shared/agent-session/activity/activity-map-event-label'
import { activityMapProviderClassification } from '../../../../../shared/agent-session/activity/activity-map-provider-options'
import { ActivityMapSettings } from './ActivityMapSettings'
import {
  useActivityMapPreferences,
  useActivityMapText,
  useActivityMapProviderOptions
} from './use-activity-map-preferences'
import { cn } from '@/lib/class-names'
import type { ActivityMapStatistics } from '../../../../../shared/agent-session/activity/activity-map-statistics'
import { X, Minus, Plus, Eye, EyeOff } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'
import { useNow } from '@/hooks/use-now'
import { ActivityMapFeed } from './ActivityMapFeed'
import { NativeChatActivityMapDiagram } from './NativeChatActivityMapDiagram'
import {
  projectAgentActivityMap,
  type ActivityMapEvent
} from '../../../../../shared/agent-session/activity/agent-activity-map'
import type { AgentJournalRenderItem } from '../../../../../shared/agent-session/journal/agent-session-journal-types'
import type { StructuredAgentContextUsage } from '../../../../../shared/agent-session/structured-agent-session-context-usage'
import type { StructuredAgentSubagentRoster } from '../../../../../shared/agent-session/view/structured-agent-session-subagent-roster'
import type { StructuredAgentHostClock } from '../../../../../shared/agent-session/structured-agent-session-reducer'

export function NativeChatActivityMap({
  items,
  events: projectedEvents,
  agentLabel,
  model,
  working,
  live,
  hostClock,
  contextUsage,
  subagentRoster,
  onClose,
  notice,
  emptyMessage,
  statistics
}: {
  items?: readonly AgentJournalRenderItem[]
  events?: readonly ActivityMapEvent[]
  agentLabel: string
  model?: string | null
  working: boolean
  live: boolean
  hostClock?: StructuredAgentHostClock | null
  contextUsage: StructuredAgentContextUsage | null
  subagentRoster: StructuredAgentSubagentRoster
  onClose: () => void
  notice?: string
  emptyMessage?: string
  statistics?: ActivityMapStatistics
}) {
  const t = useTranslate()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const text = useActivityMapText()
  const { options, update } = useActivityMapPreferences()
  const zooms = [160, 200, 240, 280, 340, 400, null]
  const zoom = zooms.indexOf(options.zoom)
  const providerOptions = useActivityMapProviderOptions()
  const classification = useMemo(
    () => activityMapProviderClassification(providerOptions),
    [providerOptions]
  )
  const events = useMemo(
    () =>
      (
        projectedEvents ??
        mergeTerminalActivity(projectAgentActivityMap(items ?? [], classification), [], [])
      )
        .filter((event) => event.mark !== 'metadata')
        .map((event) => ({ ...event, label: activityMapEventLabel(event, text) })),
    [items, projectedEvents, classification, text]
  )
  const active = events.filter((event) => event.state === 'running' || event.state === 'waiting')
  const now = useNow(1000, live)
  const hostNow = hostClock
    ? hostClock.hostNow + (live ? Math.max(0, now - hostClock.receivedAt) : 0)
    : null
  const workingAgents = [...subagentRoster.values()].filter(
    ({ entry }) => entry.state === 'working'
  ).length
  return (
    <aside
      aria-label={t('components.native-chat.activityMap.title', 'Activity map')}
      data-native-chat-activity-map=""
      style={{
        ...activityMapColors(options.colors),
        backgroundColor:
          options.background === 'solid' ? 'var(--activity-map-background, var(--card))' : undefined
      }}
      onKeyDown={(event) => {
        if (
          event.key === 'Escape' &&
          !settingsOpen &&
          !event.defaultPrevented &&
          event.target instanceof Node &&
          event.currentTarget.contains(event.target)
        ) {
          event.stopPropagation()
          onClose()
        }
      }}
      className={cn(
        'flex h-full min-h-0 flex-col text-card-foreground',
        options.background === 'solid' ? 'bg-card' : 'bg-transparent',
        options.theme !== 'auto' && `activity-map-theme-${options.theme}`
      )}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-xs font-semibold">{text.title}</h2>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={text.zoomOut}
            disabled={zoom === 0}
            onClick={() => update({ zoom: zooms[Math.max(0, zoom - 1)] })}
          >
            <Minus className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={text.zoomIn}
            disabled={zoom === zooms.length - 1}
            onClick={() => update({ zoom: zooms[Math.min(zooms.length - 1, zoom + 1)] })}
          >
            <Plus className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={options.minimized ? text.showMap : text.hideMap}
            aria-pressed={options.minimized}
            onClick={() => update({ minimized: !options.minimized })}
          >
            {options.minimized ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          </Button>
          <ActivityMapSettings onOpenChange={setSettingsOpen} />
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t('components.native-chat.activityMap.close', 'Close activity map')}
            onClick={onClose}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
        {!options.minimized ? (
          <div className="mx-auto max-w-full" style={{ width: options.zoom ?? '100%' }}>
            <NativeChatActivityMapDiagram
              events={events}
              agentLabel={agentLabel}
              model={model}
              working={working || active.length > 0 || workingAgents > 0}
              live={live}
              contextPercent={contextUsage?.percentage}
              workingAgents={workingAgents}
              hostNow={hostNow}
              statistics={statistics}
            />
          </div>
        ) : null}
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
          {notice || !live ? (
            <p role="status" className="text-xs text-muted-foreground">
              {notice ??
                t('components.native-chat.activityMap.offline', 'Waiting for session updates')}
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
          <p className="truncate font-mono text-xs">
            {active.length > 0
              ? `${text.stations[active.at(-1)!.station]}: ${active.at(-1)!.label}${active.length > 1 ? text.andMore(active.length - 1) : ''}`
              : working
                ? t('components.native-chat.activityMap.working', 'Working')
                : text.idle}
          </p>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {emptyMessage ??
                t(
                  'components.native-chat.activityMap.empty',
                  'Send a message to see activity here.'
                )}
            </p>
          ) : (
            <ActivityMapFeed events={events} hostNow={hostNow} live={live} />
          )}
        </div>
      </div>
    </aside>
  )
}
