import {
  Bot,
  Brain,
  FileText,
  Globe,
  Library,
  Monitor,
  Plug,
  Sparkles,
  SquareTerminal,
  User
} from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import type {
  ActivityMapEvent,
  ActivityMapStation
} from '../../../../../shared/agent-session/activity/agent-activity-map'

const STATIONS = [
  { id: 'you', icon: User },
  { id: 'model', icon: Brain },
  { id: 'memory', icon: Library },
  { id: 'files', icon: FileText },
  { id: 'shell', icon: SquareTerminal },
  { id: 'network', icon: Globe },
  { id: 'browser', icon: Monitor },
  { id: 'agents', icon: Bot },
  { id: 'skills', icon: Sparkles },
  { id: 'tools', icon: Plug }
] as const

function position(index: number, radius = 108) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / STATIONS.length
  return { x: 180 + radius * Math.cos(angle), y: 160 + radius * Math.sin(angle) }
}

function stationPosition(id: ActivityMapStation) {
  return position(STATIONS.findIndex((station) => station.id === id))
}

export function NativeChatActivityMapDiagram({
  events,
  agentLabel,
  working,
  live,
  contextPercent,
  workingAgents
}: {
  events: readonly ActivityMapEvent[]
  agentLabel: string
  working: boolean
  live: boolean
  contextPercent?: number
  workingAgents: number
}) {
  const t = useTranslate()
  const labels = {
    you: t('components.native-chat.activityMap.station.you', 'You'),
    model: t('components.native-chat.activityMap.station.model', 'Model'),
    memory: t('components.native-chat.activityMap.station.memory', 'Memory'),
    files: t('components.native-chat.activityMap.station.files', 'Files'),
    shell: t('components.native-chat.activityMap.station.shell', 'Shell'),
    network: t('components.native-chat.activityMap.station.network', 'Network'),
    browser: t('components.native-chat.activityMap.station.browser', 'Browser'),
    agents: t('components.native-chat.activityMap.station.agents', 'Agents'),
    skills: t('components.native-chat.activityMap.station.skills', 'Skills'),
    tools: t('components.native-chat.activityMap.station.tools', 'Tools')
  }
  const recent = events
    .filter((event) => event.origin === 'core' && event.station !== 'model')
    .slice(-8)
  const route = recent
    .map((event) => stationPosition(event.station))
    .map((point) => `${point.x},${point.y}`)
    .join(' ')
  return (
    <svg
      viewBox="0 0 360 320"
      role="img"
      aria-label={t('components.native-chat.activityMap.title', 'Activity map')}
      className="block w-full shrink-0"
    >
      <title>
        {t(
          'components.native-chat.activityMap.diagram',
          'Observed activity around the selected agent'
        )}
      </title>
      <g aria-hidden="true">
        <circle
          cx="180"
          cy="160"
          r="108"
          fill="none"
          stroke="currentColor"
          className="text-border"
          strokeDasharray="2 6"
        />
        {STATIONS.map((station, index) => {
          const point = position(index)
          const labelPoint = position(index, 139)
          const calls = events.filter((event) => event.station === station.id)
          const rootCalls = calls.filter((event) => event.origin === 'core')
          const running = calls.filter(
            (event) => event.state === 'running' || event.state === 'waiting'
          )
          const active = running.length
          const rootActive =
            running.some((event) => event.origin === 'core') ||
            (station.id === 'agents' && workingAgents > 0)
          const lit = active > 0 || rootActive
          const failed = calls.some((event) => event.state === 'failed')
          const Icon = station.icon
          return (
            <g key={station.id}>
              <line
                x1="180"
                y1="160"
                x2={point.x}
                y2={point.y}
                stroke="currentColor"
                strokeWidth={1 + Math.min(2, Math.log2(rootCalls.length + 1) / 2)}
                className={cn(
                  rootActive ? 'text-foreground' : 'text-border',
                  failed && 'text-destructive'
                )}
              />
              {rootActive && live ? (
                <circle
                  r="3"
                  fill="currentColor"
                  className={cn('activity-map-pulse text-foreground', failed && 'text-destructive')}
                  style={{ offsetPath: `path('M 180 160 L ${point.x} ${point.y}')` }}
                />
              ) : null}
              <circle
                cx={point.x}
                cy={point.y}
                r="14"
                stroke="currentColor"
                className={cn(
                  'fill-card',
                  lit ? 'text-foreground' : 'text-border',
                  failed && 'text-destructive'
                )}
              />
              <Icon
                x={point.x - 7}
                y={point.y - 7}
                width={14}
                height={14}
                className={cn(
                  lit ? 'text-foreground' : 'text-muted-foreground',
                  failed && 'text-destructive'
                )}
              />
              {active > 0 ? (
                <text
                  x={point.x + 15}
                  y={point.y - 12}
                  className="fill-current text-3xs text-foreground"
                >
                  ×{active}
                </text>
              ) : null}
              <text
                x={labelPoint.x}
                y={labelPoint.y}
                dominantBaseline="middle"
                textAnchor="middle"
                className={cn(
                  'fill-current text-xs',
                  lit ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {labels[station.id]}
              </text>
              {failed ? (
                <circle cx={point.x + 11} cy={point.y + 11} r="3" className="fill-destructive" />
              ) : null}
            </g>
          )
        })}
        <polyline
          points={route}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinejoin="round"
          className="text-muted-foreground/30"
        />
        {events
          .filter((event) => event.origin === 'agents' && event.state === 'running')
          .slice(-8)
          .map((event) => {
            const source = stationPosition('agents')
            const target = stationPosition(event.station)
            const path = `M ${source.x} ${source.y} Q 180 160 ${target.x} ${target.y}`
            return (
              <g key={event.id}>
                <path
                  d={path}
                  fill="none"
                  stroke="currentColor"
                  strokeDasharray="3 4"
                  className="text-muted-foreground"
                />
                {live ? (
                  <circle
                    r="3"
                    fill="currentColor"
                    className="activity-map-pulse text-foreground"
                    style={{ offsetPath: `path('${path}')` }}
                  />
                ) : null}
              </g>
            )
          })}
        <circle cx="180" cy="160" r="42" className="fill-card stroke-border" />
        {contextPercent !== undefined ? (
          <circle
            cx="180"
            cy="160"
            r="42"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            pathLength="100"
            strokeDasharray={`${Math.min(100, Math.max(0, contextPercent))} 100`}
            transform="rotate(-90 180 160)"
            className={contextPercent >= 90 ? 'text-destructive' : 'text-muted-foreground'}
          />
        ) : null}
        <text
          x="180"
          y="157"
          textAnchor="middle"
          className="fill-current text-xs font-semibold text-foreground"
        >
          {agentLabel.slice(0, 12)}
        </text>
        <text
          x="180"
          y="174"
          textAnchor="middle"
          className="fill-current text-3xs text-muted-foreground"
        >
          {working && live
            ? t('components.native-chat.activityMap.working', 'Working')
            : t('components.native-chat.activityMap.session', 'Session')}
        </text>
      </g>
    </svg>
  )
}
