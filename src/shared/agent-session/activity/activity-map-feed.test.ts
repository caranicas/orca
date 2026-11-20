import { expect, it } from 'vitest'
import { foldActivityMapFeed } from './activity-map-feed'
import type { ActivityMapEvent } from './agent-activity-map'

it('keeps different app actions visible while folding repeated identical actions', () => {
  const events: ActivityMapEvent[] = [
    {
      id: 'read',
      station: 'apps',
      origin: 'core',
      state: 'completed',
      label: 'excel: read range',
      startedAt: 1000
    },
    {
      id: 'update-1',
      station: 'apps',
      origin: 'core',
      state: 'completed',
      label: 'excel: update range',
      startedAt: 2000
    },
    {
      id: 'update-2',
      station: 'apps',
      origin: 'core',
      state: 'completed',
      label: 'excel: update range',
      startedAt: 3000
    },
    {
      id: 'figma',
      station: 'apps',
      origin: 'core',
      state: 'completed',
      label: 'figma: get design context',
      startedAt: 4000
    }
  ]
  expect(foldActivityMapFeed(events).map(({ event, count }) => [event.id, count])).toEqual([
    ['figma', 1],
    ['update-2', 2],
    ['read', 1]
  ])
})
