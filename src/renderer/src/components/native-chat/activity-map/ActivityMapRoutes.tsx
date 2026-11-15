import type { CSSProperties } from 'react'
import {
  ACTIVITY_MAP_STATIONS,
  activityMapEdge,
  activityMapPosition,
  activityMapRoute,
  activityMapTone
} from './activity-map-geometry'
import type { ActivityMapEvent } from '../../../../../shared/agent-session/activity/agent-activity-map'
import type { ActivityMapStatistics } from '../../../../../shared/agent-session/activity/activity-map-statistics'

export function ActivityMapRoutes({
  events,
  now,
  rotation,
  statistics
}: {
  events: readonly ActivityMapEvent[]
  now: number
  rotation: number
  statistics?: ActivityMapStatistics
}) {
  const stops = events.filter((event) => event.origin === 'core' && event.station !== 'model')
  const recent = stops
    .filter((event, index) => stops[index + 1]?.station !== event.station)
    .slice(-7)
  const core = { x: 230, y: 212 }
  return (
    <>
      {ACTIVITY_MAP_STATIONS.map((station, index) => {
        const point = activityMapPosition(index, 108, rotation)
        const count =
          statistics?.counts[station.id] ??
          events.filter(
            (event) =>
              event.station === station.id && event.mark !== 'switch' && event.mark !== 'child'
          ).length
        const worn = Math.min(1, Math.log2(1 + count) / 7)
        const a = activityMapEdge(core, point, 48)
        const b = activityMapEdge(point, core, 22)
        return (
          <g key={station.id} strokeWidth={1 + 2.6 * worn} strokeLinecap="round">
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="currentColor"
              className="text-border"
              style={{ color: 'var(--activity-map-spoke)' }}
            />
            {worn > 0 ? (
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="currentColor"
                className={activityMapTone(station.id)}
                opacity={worn * 0.55}
              />
            ) : null}
          </g>
        )
      })}
      {recent.slice(1).map((event, index) => {
        const age = Math.max(0, now - event.startedAt)
        if (age >= 60000) {
          return null
        }
        const head = index === recent.length - 2
        const route = activityMapRoute(recent[index].station, event.station, rotation)
        const style: CSSProperties & { '--route-opacity': number } = {
          color: 'var(--activity-map-route-color)',
          '--route-opacity': 0.12 + (0.5 * (index + 1)) / (recent.length - 1)
        }
        return (
          <g key={event.id}>
            <path
              d={route.path}
              fill="none"
              stroke="currentColor"
              strokeWidth={head ? 1.5 : 1.1}
              pathLength="1"
              className="activity-map-route text-muted-foreground"
              style={style}
              data-activity-started-at={event.startedAt}
            />
            {head ? (
              <circle
                cx={route.end.x}
                cy={route.end.y}
                r="2.4"
                fill="currentColor"
                className="activity-map-route-head text-muted-foreground"
                data-activity-started-at={event.startedAt}
                style={{
                  color: 'var(--activity-map-route-color)'
                }}
              />
            ) : null}
          </g>
        )
      })}
    </>
  )
}
