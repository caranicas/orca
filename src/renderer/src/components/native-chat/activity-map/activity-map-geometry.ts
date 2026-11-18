import {
  Bot,
  Cpu,
  FileText,
  Globe,
  Network,
  Monitor,
  Webhook,
  Zap,
  SquareTerminal,
  User
} from 'lucide-react'
import type { ActivityMapStation } from '../../../../../shared/agent-session/activity/agent-activity-map'

export const ACTIVITY_MAP_STATIONS = [
  { id: 'you', icon: User },
  { id: 'model', icon: Cpu },
  { id: 'memory', icon: Network },
  { id: 'files', icon: FileText },
  { id: 'shell', icon: SquareTerminal },
  { id: 'network', icon: Globe },
  { id: 'browser', icon: Monitor },
  { id: 'agents', icon: Bot },
  { id: 'skills', icon: Zap },
  { id: 'hooks', icon: Webhook }
] as const

export function activityMapPosition(index: number, radius = 108, rotation = 0) {
  const angle = -Math.PI / 2 + ((index + rotation) * 2 * Math.PI) / ACTIVITY_MAP_STATIONS.length
  return {
    x: 230 + 176 * (radius / 108) * Math.cos(angle),
    y: 212 + 164 * (radius / 108) * Math.sin(angle)
  }
}

export function activityMapEdge(
  from: { x: number; y: number },
  to: { x: number; y: number },
  radius: number
) {
  const length = Math.hypot(to.x - from.x, to.y - from.y)
  return length
    ? {
        x: from.x + ((to.x - from.x) / length) * radius,
        y: from.y + ((to.y - from.y) / length) * radius
      }
    : from
}

export function activityMapStationPosition(id: ActivityMapStation, rotation = 0) {
  return activityMapPosition(
    ACTIVITY_MAP_STATIONS.findIndex((station) => station.id === id),
    108,
    rotation
  )
}

export function activityMapTone(station: ActivityMapStation, failed = false, active = false) {
  return failed
    ? 'text-destructive'
    : station === 'memory'
      ? active
        ? 'text-activity-map-memory-hot'
        : 'text-activity-map-memory'
      : active
        ? 'text-activity-map-hot'
        : 'text-activity-map-active'
}

export function activityMapRoute(from: ActivityMapStation, to: ActivityMapStation, rotation = 0) {
  const index = (id: ActivityMapStation) =>
    ACTIVITY_MAP_STATIONS.findIndex((station) => station.id === id)
  const start = index(from)
  let steps = (index(to) - start + 10) % 10
  if (steps > 5) {
    steps -= 10
  }
  const bend = activityMapPosition(
    start + steps / 2,
    108 * ([0.5, 0.5, 0.4, 0.45, 0.55, 0.75][Math.abs(steps)] ?? 0.5),
    rotation
  )
  const a = activityMapEdge(activityMapPosition(start, 108, rotation), bend, 26)
  const b = activityMapEdge(activityMapStationPosition(to, rotation), bend, 26)
  return { path: `M ${a.x} ${a.y} Q ${bend.x} ${bend.y} ${b.x} ${b.y}`, end: b }
}
