import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { defineFixture } from '../../../component-fixtures/component-fixture'
import { NativeChatActivityMapDiagram } from './NativeChatActivityMapDiagram'
import { NativeChatActivityMap } from './NativeChatActivityMap'
import { useActivityMapPreferences } from './use-activity-map-preferences'
import type {
  ActivityMapEvent,
  ActivityMapStation
} from '../../../../../shared/agent-session/activity/agent-activity-map'

function MotionReplay() {
  const [events, setEvents] = useState<ActivityMapEvent[]>([
    {
      id: 'prompt',
      station: 'you',
      origin: 'core',
      state: 'observed',
      label: 'Message',
      startedAt: 1
    }
  ])
  const [working, setWorking] = useState(true)
  const [live, setLive] = useState(true)
  const add = (
    station: ActivityMapStation,
    state: ActivityMapEvent['state'],
    origin: ActivityMapEvent['origin'] = 'core'
  ) => {
    setWorking(true)
    setEvents((current) => [
      ...current,
      {
        id: `call-${current.length}`,
        station,
        origin,
        state,
        label: station,
        startedAt: current.length + 1
      }
    ])
  }
  return (
    <div className="native-chat-appearance bg-card text-card-foreground">
      <NativeChatActivityMapDiagram
        events={events}
        agentLabel="Codex"
        working={working}
        live={live}
        workingAgents={working ? 3 : 0}
        contextPercent={42}
      />
      <div className="flex flex-wrap gap-2 p-3">
        <Button variant="outline" onClick={() => add('shell', 'running')}>
          Shell
        </Button>
        <Button variant="outline" onClick={() => add('memory', 'completed')}>
          Quick memory
        </Button>
        <Button variant="outline" onClick={() => add('files', 'running', 'agents')}>
          Subagent
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            setEvents((current) =>
              current.map((event) =>
                event.state === 'running' ? { ...event, state: 'completed' } : event
              )
            )
          }
        >
          Complete
        </Button>
        <Button variant="outline" onClick={() => add('network', 'failed')}>
          Failure
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setWorking(false)
            setEvents((current) => [
              ...current,
              {
                id: `answer-${current.length}`,
                station: 'you',
                origin: 'core',
                state: 'completed',
                label: 'Answer ready',
                startedAt: current.length + 1,
                mark: 'done'
              }
            ])
          }}
        >
          Answer
        </Button>
        <Button variant="outline" onClick={() => setLive((current) => !current)}>
          Connection
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            setEvents((current) => [
              {
                id: 'old-history',
                station: 'files',
                origin: 'core',
                state: 'completed',
                label: 'Earlier tool',
                startedAt: 0
              },
              ...current
            ])
          }
        >
          History
        </Button>
      </div>
    </div>
  )
}

export const replay = defineFixture({ width: 360, render: () => <MotionReplay /> })

const TIMELINE_START = 1_700_000_000_000
const TIMELINE_EVENTS: ActivityMapEvent[] = [
  {
    id: 'active-file',
    station: 'files',
    origin: 'core',
    state: 'running',
    label: 'Files',
    startedAt: TIMELINE_START - 85000
  },
  {
    id: 'route-memory',
    station: 'memory',
    origin: 'core',
    state: 'completed',
    label: 'Memory',
    startedAt: TIMELINE_START
  },
  {
    id: 'switch',
    station: 'model',
    origin: 'core',
    state: 'completed',
    label: 'Model changed',
    mark: 'switch',
    startedAt: TIMELINE_START + 1000
  },
  {
    id: 'route-shell',
    station: 'shell',
    origin: 'core',
    state: 'completed',
    label: 'Shell',
    startedAt: TIMELINE_START + 2000,
    endedAt: TIMELINE_START + 2500
  }
]

function TimelineReplay() {
  const [now, setNow] = useState(TIMELINE_START + 3000)
  const [live, setLive] = useState(true)
  const [revision, setRevision] = useState(0)
  const { options, update } = useActivityMapPreferences()
  return (
    <div className="native-chat-appearance bg-card text-card-foreground">
      <NativeChatActivityMapDiagram
        events={TIMELINE_EVENTS}
        agentLabel="Codex"
        model="gpt-6.1-sol"
        working
        live={live}
        workingAgents={0}
        hostNow={now}
        contextPercent={72}
      />
      <div className="flex flex-wrap gap-2 p-3">
        <Button variant="outline" onClick={() => setNow(TIMELINE_START + 3000)}>
          Reset time
        </Button>
        <Button variant="outline" onClick={() => setNow((value) => value + 1000)}>
          Tick
        </Button>
        <Button variant="outline" onClick={() => setRevision((value) => value + 1)}>
          Render {revision}
        </Button>
        <Button variant="outline" onClick={() => setNow(TIMELINE_START + 44000)}>
          Age route
        </Button>
        <Button variant="outline" onClick={() => setNow(TIMELINE_START + 800000)}>
          Age clocks
        </Button>
        <Button variant="outline" onClick={() => setLive((value) => !value)}>
          Connection
        </Button>
        <Button
          variant="outline"
          onClick={() => update({ motion: options.motion === 'full' ? 'reduced' : 'full' })}
        >
          Motion
        </Button>
      </div>
    </div>
  )
}

export const timeline = defineFixture({ width: 360, render: () => <TimelineReplay /> })

function ContextPreview() {
  const [percentage, setPercentage] = useState<number>()
  return (
    <div className="native-chat-appearance bg-card text-card-foreground">
      <NativeChatActivityMapDiagram
        events={[]}
        agentLabel="Codex"
        model="gpt-6.1-sol"
        working={false}
        live={false}
        workingAgents={0}
        contextPercent={percentage}
      />
      <div className="flex flex-wrap gap-2 p-3">
        {[undefined, 69, 70, 89, 90].map((value) => (
          <Button key={value ?? 'unknown'} variant="outline" onClick={() => setPercentage(value)}>
            {value === undefined ? 'Unknown' : `${value}%`}
          </Button>
        ))}
      </div>
    </div>
  )
}

export const context = defineFixture({ width: 360, render: () => <ContextPreview /> })

export const labels = defineFixture({
  width: 360,
  render: () => (
    <div className="native-chat-appearance h-160">
      <NativeChatActivityMap
        events={[
          {
            id: 'file',
            station: 'files',
            origin: 'core',
            state: 'completed',
            label: 'src/activity-map-observation-reconciliation.ts',
            startedAt: 1000
          },
          {
            id: 'network',
            station: 'network',
            origin: 'core',
            state: 'failed',
            label: 'example.invalid / activity-map-observation-reconciliation',
            startedAt: 2000
          }
        ]}
        agentLabel="Codex"
        working={false}
        live={false}
        contextUsage={null}
        subagentRoster={new Map()}
        onClose={() => {}}
      />
    </div>
  )
})
