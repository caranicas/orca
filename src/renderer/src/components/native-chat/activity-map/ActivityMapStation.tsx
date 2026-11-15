import { cn } from '@/lib/class-names'
import type { CSSProperties } from 'react'
import {
  ACTIVITY_MAP_STATIONS,
  activityMapPosition,
  activityMapTone
} from './activity-map-geometry'
import type { ActivityMapEvent } from '../../../../../shared/agent-session/activity/agent-activity-map'

export function ActivityMapStation({
  index,
  events,
  faults,
  label,
  workingAgents,
  now,
  count,
  rotation,
  pushed
}: {
  index: number
  events: readonly ActivityMapEvent[]
  faults: number
  label: string
  workingAgents: number
  now: number
  count?: number
  rotation: number
  pushed?: number
}) {
  const station = ACTIVITY_MAP_STATIONS[index]
  const point = activityMapPosition(index, 108, rotation)
  const labelPoint = { x: point.x, y: point.y + 37 }
  const calls = events.filter((event) => event.station === station.id)
  const counted =
    count ?? calls.filter((event) => event.mark !== 'switch' && event.mark !== 'child').length
  const received =
    pushed ?? (station.id === 'memory' ? calls.filter((event) => event.inbound).length : 0)
  const running = calls.filter((event) => event.state === 'running' || event.state === 'waiting')
  const active = running.length
  const last = Math.max(0, ...calls.map((event) => event.endedAt ?? event.startedAt))
  const age = Math.max(0, now - last)
  const lit = active > 0 || (station.id === 'agents' && workingAgents > 0)
  const alarm = Math.max(
    0,
    ...calls
      .filter((event) => event.state === 'failed' || event.state === 'blocked')
      .map((event) => event.endedAt ?? event.startedAt)
  )
  const alarmAge = alarm > 0 ? Math.max(0, now - alarm) : Infinity
  const isAlarm = now > 0 && alarmAge < 6000
  const warm = lit || (now > 0 && age < 3200) || isAlarm
  const tone = activityMapTone(station.id, isAlarm)
  const Icon = station.icon
  const switchedAt =
    station.id === 'model'
      ? Math.max(
          0,
          ...calls.filter((event) => event.mark === 'switch').map((event) => event.startedAt)
        )
      : 0
  const started = Math.min(...running.map((event) => event.startedAt))
  const switchStyle: CSSProperties & { '--activity-map-radius': string } = {
    '--activity-map-radius': '22px'
  }
  const coolingAt = isAlarm ? alarm : last
  const coolingStyle: CSSProperties & { '--activity-map-cooling-duration': string } = {
    '--activity-map-cooling-duration': isAlarm ? '6000ms' : '3200ms'
  }
  return (
    <g>
      {switchedAt > 0 && now >= switchedAt && now - switchedAt < 8000 ? (
        <circle
          key={switchedAt}
          cx={point.x}
          cy={point.y}
          r="22"
          fill="none"
          stroke="currentColor"
          className="activity-map-model-switch text-foreground"
          style={switchStyle}
          data-activity-started-at={switchedAt}
        />
      ) : null}
      {warm ? (
        <circle
          cx={point.x}
          cy={point.y}
          r="32"
          fill="currentColor"
          className={cn(tone, !(lit && !isAlarm) && 'activity-map-cooling')}
          opacity={lit && !isAlarm ? 0.16 : 0.3}
          data-activity-started-at={lit && !isAlarm ? undefined : coolingAt}
          style={coolingStyle}
        />
      ) : null}
      {lit ? (
        <g className={tone}>
          <circle
            cx={point.x}
            cy={point.y}
            r="22"
            fill="none"
            stroke="currentColor"
            className="activity-map-station-beat"
            data-activity-started-at={Number.isFinite(started) ? started : undefined}
          />
          {[60_000, 600_000].map((period, i) => (
            <circle
              key={period}
              cx={point.x}
              cy={point.y}
              r={26 + i * 4}
              fill="none"
              stroke="currentColor"
              strokeWidth={i ? 1 : 2}
              pathLength="1"
              strokeDasharray="1 1"
              className="activity-map-clock"
              data-activity-started-at={Number.isFinite(started) ? started : undefined}
              style={{
                animationDuration: `${period}ms`,
                animationIterationCount: i ? 1 : 'infinite',
                animationFillMode: 'both'
              }}
              transform={`rotate(-90 ${point.x} ${point.y})`}
            />
          ))}
        </g>
      ) : null}
      <circle
        cx={point.x}
        cy={point.y}
        r="22"
        stroke="currentColor"
        className="activity-map-node text-border"
      />
      {warm ? (
        <circle
          cx={point.x}
          cy={point.y}
          r="22"
          fill="none"
          stroke="currentColor"
          className={cn(tone, !(lit && !isAlarm) && 'activity-map-cooling')}
          data-activity-started-at={lit && !isAlarm ? undefined : coolingAt}
          style={coolingStyle}
        />
      ) : null}
      <Icon
        x={point.x - 9}
        y={point.y - 9}
        width={18}
        height={18}
        className={
          warm || (station.id === 'memory' && counted)
            ? activityMapTone(station.id, isAlarm, warm)
            : 'text-muted-foreground'
        }
      />
      {active > 1 ? (
        <text x={point.x + 15} y={point.y - 12} className={cn('fill-current text-3xs', tone)}>
          ×{active}
        </text>
      ) : null}
      <text
        x={labelPoint.x}
        y={labelPoint.y}
        dominantBaseline="middle"
        textAnchor="middle"
        className={cn(
          'activity-map-label fill-current text-xs',
          warm ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {label}
      </text>
      {counted > 0 || received ? (
        <text
          x={labelPoint.x}
          y={labelPoint.y + 14}
          textAnchor="middle"
          className="activity-map-label fill-current text-3xs text-activity-map-faint"
        >
          {received > 0 ? (counted > received ? `${counted - received} ` : '') : counted}
          {received ? `↓${received}` : ''}
        </text>
      ) : null}
      {faults > 0 ? (
        <g className="text-destructive">
          <circle cx={point.x - 16} cy={point.y - 16} r="7.5" fill="currentColor" />
          <text
            x={point.x - 16}
            y={point.y - 13}
            textAnchor="middle"
            className="fill-current text-3xs text-card"
          >
            {faults > 99 ? '99+' : faults}
          </text>
        </g>
      ) : null}
    </g>
  )
}
