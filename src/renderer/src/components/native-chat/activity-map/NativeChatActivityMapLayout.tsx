import { useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { NativeChatActivityMap } from './NativeChatActivityMap'
import { useActivityMapJournal } from './use-activity-map-journal'
import { codexContextPercentage } from '../../../../../shared/agent-session/activity/terminal-activity-telemetry'
import { toRuntimeExecutionHostId } from '../../../../../shared/execution-host'
import { useActivityMapModelHistory } from './use-activity-map-model-history'
import { useAppStore } from '@/store'
import { resolveWorkspaceDirectory } from '@/lib/workspace/paths/workspace-directory'
import { projectAgentActivityMap } from '../../../../../shared/agent-session/activity/agent-activity-map'
import { activityMapProviderClassification } from '../../../../../shared/agent-session/activity/activity-map-provider-options'
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
  Partial<Pick<ReturnType<typeof useStructuredAgentSession>, 'optionSnapshot'>>

export function NativeChatActivityMapLayout({
  pane,
  ownerWorktreeId,
  colorScheme,
  handOff,
  controller,
  agentLabel,
  hostOnline,
  children
}: {
  pane: Omit<NativeChatStructuredViewProps, 'mode'>
  ownerWorktreeId: string | null
  colorScheme: CSSProperties['colorScheme']
  handOff: NativeChatHandOff
  controller: ActivityController
  agentLabel: string
  hostOnline: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const triggerId = useId()
  const journal = useActivityMapJournal({
    target: pane.target,
    sessionId: pane.sessionId,
    epoch: controller.epoch,
    items: controller.journalItems,
    enabled: open && pane.isVisible && controller.readCurrent && hostOnline
  })
  const contextUsage =
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
  const reportedModel = controller.optionSnapshot?.find(
    (option) => option.id === 'model' && option.valueSource === 'reported'
  )
  const model = reportedModel?.kind.type === 'select' ? reportedModel.kind.currentValue : undefined
  const host = pane.target.kind === 'environment' ? pane.target.environmentId : null
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
    at: controller.hostClock?.hostNow,
    withinSession: true
  })
  const options = useActivityMapProviderOptions()
  const events = useMemo(
    () =>
      mergeTerminalActivity(
        journal?.events ??
          projectAgentActivityMap(
            controller.journalItems,
            activityMapProviderClassification(options)
          ),
        change ? [change] : [],
        []
      ),
    [journal, controller.journalItems, options, change]
  )
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
            <NativeChatActivityMap
              key={`${pane.sessionId}:${controller.epoch}:${controller.contextClear.clears}`}
              items={controller.journalItems}
              events={events}
              statistics={journal?.statistics}
              agentLabel={agentLabel}
              model={model}
              working={controller.isWorking}
              live={controller.readCurrent && controller.status === 'ready' && hostOnline}
              hostClock={controller.hostClock}
              contextUsage={contextUsage}
              subagentRoster={controller.subagentRoster}
              onClose={() => {
                setOpen(false)
                document.getElementById(triggerId)?.focus({ preventScroll: true })
              }}
            />
          ) : null
        }
      >
        {children}
      </NativeChatActivityMapFrame>
    </>
  )
}
