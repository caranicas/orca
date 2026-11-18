import {
  NativeChatCrewFrame,
  NativeChatCrewPanel
} from '../../orchestration-crew/NativeChatCrewPanel'
import {
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
  type ComponentProps
} from 'react'
import { NativeChatActivityMap } from './NativeChatActivityMap'
import { useActivityMapJournal } from './use-activity-map-journal'
import { codexContextPercentage } from '../../../../../shared/agent-session/activity/terminal-activity-telemetry'
import { toRuntimeExecutionHostId } from '../../../../../shared/execution-host/execution-host'
import { useActivityMapModelHistory } from './use-activity-map-model-history'
import { useAppStore } from '@/store'
import { resolveWorkspaceDirectory } from '@/lib/workspace/paths/workspace-directory'
import { activityMapJournalSummary } from '../../../../../shared/agent-session/activity/activity-map-journal-summary'
import { activityMapJournalTelemetry } from '../../../../../shared/agent-session/activity/activity-map-journal-telemetry'
import { structuredAgentSessionPaneKey } from '../../../../../shared/agent-session/view/structured-agent-session-projection'
import { useNativeChatLiveSession } from '../session/terminal/read/use-native-chat-live-session'
import { useActivityMapProviderOptions } from './use-activity-map-preferences'
import { mergeTerminalActivity } from '../../../../../shared/agent-session/activity/merge-terminal-activity'
import { nativeChatPaneHeader } from '../pane/actions/NativeChatPaneHeader'
import type { NativeChatHandOff } from '../pane/actions/use-native-chat-hand-off'
import type { NativeChatStructuredViewProps } from '../native-chat-view-types'
import type { useStructuredAgentSession } from '../session/structured/use-structured-agent-session'

export function NativeChatActivityMapFrame({
  children,
  panel
}: {
  children: ReactNode
  panel: ReactNode
}) {
  return (
    <div className="@container relative flex min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1">{children}</div>
      {panel ? (
        <div className="absolute inset-0 z-10 min-h-0 border-border @3xl:static @3xl:w-80 @3xl:shrink-0 @3xl:border-l">
          {panel}
        </div>
      ) : null}
    </div>
  )
}

type ActivityController = Pick<
  ReturnType<typeof useStructuredAgentSession>,
  | 'journalItems'
  | 'epoch'
  | 'hostClock'
  | 'contextClear'
  | 'isWorking'
  | 'readCurrent'
  | 'status'
  | 'contextUsage'
  | 'subagentRoster'
> &
  Partial<
    Pick<
      ReturnType<typeof useStructuredAgentSession>,
      'optionSnapshot' | 'transcriptPath' | 'transcriptSessionId'
    >
  >

export function NativeChatActivityMapLayout({
  pane,
  ownerWorktreeId,
  colorScheme,
  handOff,
  controller,
  agentLabel,
  hostOnline,
  crew,
  children
}: {
  pane: Omit<NativeChatStructuredViewProps, 'mode'>
  ownerWorktreeId: string | null
  colorScheme: CSSProperties['colorScheme']
  handOff: NativeChatHandOff
  controller: ActivityController
  agentLabel: string
  hostOnline: boolean
  crew?: ComponentProps<typeof NativeChatCrewPanel>
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const triggerId = useId()
  return (
    <>
      {nativeChatPaneHeader(pane, ownerWorktreeId, colorScheme, handOff, {
        open,
        triggerId,
        toggle: () => setOpen((value) => !value)
      })}
      <NativeChatActivityMapFrame
        panel={
          open && pane.isVisible ? (
            <NativeChatActivityMapSession
              key={JSON.stringify([
                pane.target,
                pane.sessionId,
                controller.epoch,
                controller.contextClear.clears,
                controller.transcriptPath,
                controller.transcriptSessionId
              ])}
              pane={pane}
              ownerWorktreeId={ownerWorktreeId}
              controller={controller}
              agentLabel={agentLabel}
              hostOnline={hostOnline}
              onClose={() => {
                setOpen(false)
                document.getElementById(triggerId)?.focus({ preventScroll: true })
              }}
            />
          ) : null
        }
      >
        {crew ? (
          <NativeChatCrewFrame panel={<NativeChatCrewPanel {...crew} />}>
            {children}
          </NativeChatCrewFrame>
        ) : (
          children
        )}
      </NativeChatActivityMapFrame>
    </>
  )
}

function NativeChatActivityMapSession({
  pane,
  ownerWorktreeId,
  controller,
  agentLabel,
  hostOnline,
  onClose
}: {
  pane: Omit<NativeChatStructuredViewProps, 'mode'>
  ownerWorktreeId: string | null
  controller: ActivityController
  agentLabel: string
  hostOnline: boolean
  onClose: () => void
}) {
  const options = useActivityMapProviderOptions()
  const host = pane.target.kind === 'environment' ? pane.target.environmentId : null
  const transcript = useNativeChatLiveSession({
    agent: pane.agent,
    paneKey: structuredAgentSessionPaneKey(pane.tabId, pane.sessionId),
    sessionId: controller.transcriptSessionId ?? null,
    transcriptPath: controller.transcriptPath,
    runtimeEnvironmentId: host,
    enabled:
      pane.agent === 'codex' &&
      Boolean(controller.transcriptPath) &&
      Boolean(controller.transcriptSessionId) &&
      pane.isVisible &&
      controller.readCurrent &&
      hostOnline,
    activityMap: true,
    activityMapOptions: options
  })
  const telemetry = transcript.readPhase === 'ready' ? transcript.activityMap : undefined
  const journal = useActivityMapJournal({
    target: pane.target,
    sessionId: pane.sessionId,
    epoch: controller.epoch,
    items: controller.journalItems,
    enabled: pane.isVisible && controller.readCurrent && hostOnline
  })
  const nativeContextUsage =
    controller.contextUsage && pane.agent === 'codex'
      ? {
          ...controller.contextUsage,
          estimated: true,
          percentage: codexContextPercentage(
            controller.contextUsage.usedTokens,
            controller.contextUsage.windowTokens
          )
        }
      : controller.contextUsage
  const contextUsage = telemetry ? telemetry.contextUsage : nativeContextUsage
  const reportedModel = controller.optionSnapshot?.find((option) => option.id === 'model')
  const model =
    telemetry?.model ??
    (reportedModel?.valueSource === 'reported' && reportedModel.kind.type === 'select'
      ? reportedModel.kind.currentValue
      : undefined)
  const cwd = useAppStore((state) =>
    ownerWorktreeId
      ? resolveWorkspaceDirectory(
          state,
          ownerWorktreeId,
          host ? toRuntimeExecutionHostId(host) : 'local'
        )
      : null
  )
  const change = useActivityMapModelHistory({
    host,
    cwd: cwd ?? undefined,
    provider: pane.agent,
    sessionId: pane.sessionId,
    model,
    at: telemetry?.modelAt ?? controller.hostClock?.hostNow,
    withinSession: true
  })
  const activity = useMemo(() => {
    const combined = activityMapJournalTelemetry(
      journal ?? activityMapJournalSummary(controller.journalItems, options),
      telemetry
    )
    return {
      ...combined,
      events: mergeTerminalActivity(combined.events, change ? [change] : [], [])
    }
  }, [journal, controller.journalItems, options, telemetry, change])
  return (
    <NativeChatActivityMap
      items={controller.journalItems}
      events={activity.events}
      statistics={activity.statistics}
      agentLabel={agentLabel}
      model={model}
      working={controller.isWorking}
      live={controller.readCurrent && controller.status === 'ready' && hostOnline}
      hostClock={controller.hostClock}
      contextUsage={contextUsage}
      subagentRoster={controller.subagentRoster}
      onClose={onClose}
    />
  )
}
