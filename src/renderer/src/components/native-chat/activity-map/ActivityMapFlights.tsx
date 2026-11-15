import type { CSSProperties } from 'react'
import { cn } from '@/lib/class-names'
import { activityMapStationPosition, activityMapTone } from './activity-map-geometry'
import type { ActivityMapFlight } from './use-activity-map-motion'

export function ActivityMapFlights({
  flights,
  onFinish,
  rotation
}: {
  flights: readonly ActivityMapFlight[]
  onFinish: (key: string) => void
  rotation: number
}) {
  return flights.map((flight) => {
    const { event, returning, delay, lane } = flight
    const core = { x: 230, y: 212 }
    const source = event.origin === 'agents' ? activityMapStationPosition('agents', rotation) : core
    const target = activityMapStationPosition(event.station, rotation)
    const length = Math.hypot(target.x - source.x, target.y - source.y)
    if (!length) {
      return null
    }
    const dx = (target.x - source.x) / length
    const dy = (target.y - source.y) / length
    const startRadius = event.origin === 'agents' ? 22 : 48
    const a = {
      x: source.x + dx * startRadius - dy * lane,
      y: source.y + dy * startRadius + dx * lane
    }
    const b = { x: target.x - dx * 22 - dy * lane, y: target.y - dy * 22 + dx * lane }
    const inbound = returning || event.mark === 'prompt' || event.inbound === true
    const path = inbound ? `M ${b.x} ${b.y} L ${a.x} ${a.y}` : `M ${a.x} ${a.y} L ${b.x} ${b.y}`
    const landing = inbound ? source : target
    const tone =
      returning && event.state === 'completed'
        ? 'text-muted-foreground'
        : activityMapTone(
            event.station,
            event.state === 'failed' || event.state === 'blocked',
            true
          )
    const arrivalStyle: CSSProperties & { '--activity-map-radius': string } = {
      animationDelay: `${delay + 0.8}s`,
      '--activity-map-radius': inbound && event.origin !== 'agents' ? '46px' : '22px'
    }
    return (
      <g key={flight.key} className={tone}>
        {!returning ? (
          <path
            d={path}
            fill="none"
            stroke="currentColor"
            strokeDasharray={event.inbound ? '3 4' : undefined}
            className="activity-map-beam"
          />
        ) : null}
        {(event.inbound ? [0] : [2, 1, 0]).map((tail) => {
          const style: CSSProperties & { '--flight-opacity': number } = {
            offsetPath: `path('${path}')`,
            animationDelay: `${delay + tail * 0.045}s`,
            '--flight-opacity': 1 - tail * 0.36
          }
          return (
            <circle
              key={tail}
              r={(returning ? 2.6 : 3.8) * (1 - tail * 0.27)}
              fill={event.inbound ? 'none' : 'currentColor'}
              stroke={event.inbound ? 'currentColor' : undefined}
              className="activity-map-flight"
              style={style}
              onAnimationEnd={returning && tail === 2 ? () => onFinish(flight.key) : undefined}
            />
          )
        })}
        {!returning ? (
          <circle
            cx={landing.x}
            cy={landing.y}
            r={inbound && event.origin !== 'agents' ? 46 : 22}
            fill="none"
            stroke="currentColor"
            className={cn(
              'activity-map-arrival',
              inbound && event.origin !== 'agents' && 'activity-map-arrival-core'
            )}
            style={arrivalStyle}
            onAnimationEnd={() => onFinish(flight.key)}
          />
        ) : null}
      </g>
    )
  })
}
