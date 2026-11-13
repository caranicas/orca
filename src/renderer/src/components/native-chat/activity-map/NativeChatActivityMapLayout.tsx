import { useId, useState, type CSSProperties, type ReactNode } from 'react'
import { NativeChatActivityMap } from './NativeChatActivityMap'
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
>

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
              agentLabel={agentLabel}
              working={controller.isWorking}
              live={controller.readCurrent && controller.status === 'ready' && hostOnline}
              hostClock={controller.hostClock}
              contextUsage={controller.contextUsage}
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
