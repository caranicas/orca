import { useActivityMapPreferences, useActivityMapText } from './use-activity-map-preferences'
import type { ActivityMapStatistics } from '../../../../../shared/agent-session/activity/activity-map-statistics'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { activityMapFaults } from '../../../../../shared/agent-session/activity/activity-map-feed'
import { ActivityMapStation } from './ActivityMapStation'
import { ActivityMapRoutes } from './ActivityMapRoutes'
import { ActivityMapFlights } from './ActivityMapFlights'
import { useActivityMapMotion } from './use-activity-map-motion'
import { useActivityMapAnimationClock } from './use-activity-map-animation-clock'
import {
  ACTIVITY_MAP_STATIONS,
  activityMapStationPosition,
  activityMapTone
} from './activity-map-geometry'
import type { ActivityMapEvent } from '../../../../../shared/agent-session/activity/agent-activity-map'
import { shortModel } from '../../../../../shared/agent-session/activity/activity-map-labels'

type ActivityMapDiagramProps = {
  events: readonly ActivityMapEvent[]
  agentLabel: string
  model?: string | null
  working: boolean
  live: boolean
  contextPercent?: number
  workingAgents: number
  hostNow?: number | null
  statistics?: ActivityMapStatistics
}

export function NativeChatActivityMapDiagram(props: ActivityMapDiagramProps) {
  const motion = useActivityMapPreferences((state) => state.options.motion)
  const osReduced = usePrefersReducedMotion()
  const reducedMotion = osReduced || motion === 'reduced'
  return (
    <ActivityMapDiagram
      key={reducedMotion ? 'reduced' : 'full'}
      {...props}
      reducedMotion={reducedMotion}
    />
  )
}

function ActivityMapDiagram({
  events,
  agentLabel,
  model,
  working,
  live,
  contextPercent,
  workingAgents,
  hostNow,
  statistics,
  reducedMotion
}: ActivityMapDiagramProps & { reducedMotion: boolean }) {
  const t = useTranslate()
  const now = hostNow ?? 0
  const diagram = useActivityMapAnimationClock(now, live)
  const loadedFaults = activityMapFaults(events)
  const newestPrompt = Math.max(
    0,
    ...events.filter((event) => event.mark === 'prompt').map((event) => event.startedAt)
  )
  const faults =
    statistics && newestPrompt <= statistics.clearedAt
      ? new Map(Object.entries(statistics.faults))
      : loadedFaults
  const switchedAt = Math.max(
    0,
    ...events.filter((event) => event.mark === 'switch').map((event) => event.startedAt)
  )
  const options = useActivityMapPreferences((state) => state.options)
  const rotation = options.layout === 'you-bottom' ? 5 : 0
  const motion = useActivityMapMotion(events, live && !reducedMotion)
  const labels = useActivityMapText().stations
  const agentsAt = activityMapStationPosition('agents', rotation)
  return (
    <svg
      ref={diagram}
      viewBox="0 0 460 430"
      role="img"
      aria-label={t('components.native-chat.activityMap.title', 'Activity map')}
      className="activity-map-diagram block w-full shrink-0"
      data-live={live}
      data-motion={reducedMotion ? 'reduced' : 'full'}
    >
      <title>
        {t(
          'components.native-chat.activityMap.diagram',
          'Observed activity around the selected agent'
        )}
      </title>
      <g aria-hidden="true">
        {[
          [66, 62],
          [104, 97],
          [142, 132]
        ].map(([rx, ry]) => (
          <ellipse
            key={rx}
            cx="230"
            cy="212"
            rx={rx}
            ry={ry}
            fill="none"
            stroke="currentColor"
            className="activity-map-grid text-border"
            strokeDasharray="2 5"
            opacity="0.45"
          />
        ))}
        <ActivityMapRoutes events={events} now={now} rotation={rotation} statistics={statistics} />
        {events
          .filter(
            (event) =>
              event.origin === 'agents' && (event.state === 'running' || event.state === 'waiting')
          )
          .slice(-8)
          .map((event) => {
            const target = activityMapStationPosition(event.station, rotation)
            return (
              <path
                key={event.id}
                d={`M ${agentsAt.x} ${agentsAt.y} L ${target.x} ${target.y}`}
                fill="none"
                stroke="currentColor"
                strokeDasharray="3 4"
                className={activityMapTone(event.station)}
                opacity="0.4"
              />
            )
          })}
        <ActivityMapFlights flights={motion.flights} onFinish={motion.finish} rotation={rotation} />
        {ACTIVITY_MAP_STATIONS.map((station, index) => (
          <ActivityMapStation
            key={station.id}
            index={index}
            rotation={rotation}
            events={events}
            faults={faults.get(station.id) ?? 0}
            label={labels[station.id]}
            workingAgents={workingAgents}
            now={now}
            count={statistics?.counts[station.id]}
            pushed={station.id === 'memory' ? statistics?.pushed : undefined}
          />
        ))}
        {Array.from({ length: Math.min(workingAgents, 6) }, (_, index) => (
          <g
            key={index}
            transform={`rotate(${(index * 360) / Math.min(workingAgents, 6)} ${agentsAt.x} ${agentsAt.y})`}
          >
            <g
              className="activity-map-orbit text-activity-map-hot"
              style={{ transformOrigin: `${agentsAt.x}px ${agentsAt.y}px` }}
            >
              <circle cx={agentsAt.x} cy={agentsAt.y - 28} r="3" fill="currentColor" />
            </g>
          </g>
        ))}
        {switchedAt > 0 && now >= switchedAt && now - switchedAt < 8000 ? (
          <circle
            key={switchedAt}
            cx="230"
            cy="212"
            r="40"
            fill="none"
            stroke="currentColor"
            className="activity-map-model-switch text-foreground"
            data-activity-started-at={switchedAt}
          />
        ) : null}
        <circle
          cx="230"
          cy="212"
          r="48"
          className="activity-map-breath fill-activity-map-active"
          data-working={working}
        />
        {motion.answer > 0 ? (
          <circle
            key={motion.answer}
            cx="230"
            cy="212"
            r="40"
            fill="none"
            stroke="currentColor"
            className="activity-map-answer text-foreground"
          />
        ) : null}
        <circle
          cx="230"
          cy="212"
          r="40"
          className={cn(
            'activity-map-node',
            working ? 'stroke-activity-map-active' : 'stroke-border'
          )}
        />
        {contextPercent !== undefined ? (
          <circle
            cx="230"
            cy="212"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            pathLength="100"
            strokeDasharray={`${Math.min(100, Math.max(0, contextPercent))} 100`}
            transform="rotate(-90 230 212)"
            className={
              contextPercent >= 90
                ? 'text-destructive'
                : contextPercent >= 70
                  ? 'text-activity-map-active'
                  : 'text-muted-foreground'
            }
          />
        ) : null}
        <text
          x="230"
          y="193"
          textAnchor="middle"
          className="fill-current text-3xs text-activity-map-faint"
        >
          {contextPercent === undefined ? '?%' : `${Math.round(contextPercent)}%`}
        </text>
        <text
          x="230"
          y="213"
          textAnchor="middle"
          className={cn(
            'fill-current font-semibold text-foreground',
            (options.coreName.trim() || agentLabel).length > 6 ? 'text-2xs' : 'text-sm'
          )}
        >
          {(options.coreName.trim() || agentLabel).slice(0, 12)}
        </text>
        <text
          x="230"
          y="229"
          textAnchor="middle"
          className="fill-current text-3xs text-muted-foreground"
        >
          {(model ? shortModel(model) : undefined) ??
            t('components.native-chat.activityMap.unknownModel', 'Unknown model')}
        </text>
      </g>
    </svg>
  )
}
