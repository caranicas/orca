import type { CSSProperties } from 'react'

const VARIABLES: Record<string, `--${string}`> = {
  background: '--activity-map-background',
  node: '--activity-map-node',
  line: '--border',
  spoke: '--activity-map-spoke',
  text: '--foreground',
  label: '--muted-foreground',
  faint: '--activity-map-faint',
  accent: '--activity-map-active',
  active: '--activity-map-hot',
  error: '--destructive',
  memory: '--activity-map-memory',
  memoryActive: '--activity-map-memory-hot',
  route: '--activity-map-route-color'
}

export function activityMapColors(pairs: readonly string[]): CSSProperties {
  const style: CSSProperties & Partial<Record<`--${string}`, string>> = {}
  for (const pair of pairs) {
    const at = pair.indexOf('=')
    const variable = VARIABLES[pair.slice(0, at).trim()]
    const hex = pair.slice(at + 1).trim()
    if (at > 0 && variable && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) {
      style[variable] = hex
    }
  }
  return style
}
