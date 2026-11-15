import { useActivityMapProviderOptions } from '../../native-chat/activity-map/use-activity-map-preferences'
import { useActivityMapModelHistory } from '../../native-chat/activity-map/use-activity-map-model-history'
import { activityMapProviderClassification } from '../../../../../shared/agent-session/activity/activity-map-provider-options'
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { useTranslate } from '@/i18n/use-translate'
import { NativeChatActivityMap } from '../../native-chat/activity-map/NativeChatActivityMap'
import { useNativeChatLiveSession } from '../../native-chat/session/terminal/read/use-native-chat-live-session'
import type { UseNativeChatLiveSessionArgs } from '../../native-chat/session/terminal/read/native-chat-live-session-contract'
import { selectNativeChatRuntimeEnvironmentId } from '../../native-chat/pane/ownership/native-chat-runtime-owner'
import { resolvePaneAgentSessionId } from '@/lib/agent-session/identity/pane-agent-session-id'
import { makePaneKey } from '../../../../../shared/workspace-layout/stable-pane-id'
import { isNativeChatSupportedAgent } from '../../../../../shared/native-chat/native-chat-agent-support'
import { projectTerminalAgentActivityMap } from '../../../../../shared/agent-session/activity/terminal-agent-activity-map'
import { terminalActivityChildWork } from '../../../../../shared/agent-session/activity/terminal-activity-child-work'
import { mergeTerminalActivity } from '../../../../../shared/agent-session/activity/merge-terminal-activity'
import type { AgentStatusEntry } from '../../../../../shared/agent-status/contracts/agent-status-types'
import { tuiAgentDisplayName } from '../../../../../shared/agent-launch/catalog/tui-agent-display-names'
import type { TerminalPaneController } from '../controller/use-terminal-pane-controller'

export function TerminalAgentActivityMap({
  controller,
  leafId,
  onClose
}: {
  controller: Pick<TerminalPaneController, 'tabId' | 'isRendererVisible' | 'resolveAgentForLeaf'>
  leafId: string
  onClose: () => void
}) {
  const t = useTranslate()
  const activityMapOptions = useActivityMapProviderOptions()
  const paneKey = makePaneKey(controller.tabId, leafId)
  const source = useAppStore(
    useShallow((state) => {
      const entry = state.agentStatusByPaneKey[paneKey]
      const shell = state.paneForegroundAgentByPaneKey[paneKey]?.shellForeground === true
      return {
        agent: shell ? null : (entry?.agentType ?? controller.resolveAgentForLeaf(leafId)),
        sessionId: shell ? null : resolvePaneAgentSessionId(state, paneKey),
        transcriptPath: shell ? null : (entry?.providerSession?.transcriptPath ?? null),
        runtimeEnvironmentId: selectNativeChatRuntimeEnvironmentId(state, controller.tabId),
        status: shell ? undefined : entry
      }
    })
  )
  const supported = isNativeChatSupportedAgent(source.agent)
  const agentLabel = source.agent
    ? (tuiAgentDisplayName(source.agent) ?? source.agent)
    : t('components.terminal.activityMap.terminal', 'Terminal')
  return (
    <TerminalActivityMapSession
      key={JSON.stringify([
        paneKey,
        source.agent,
        source.sessionId,
        source.transcriptPath,
        source.runtimeEnvironmentId
      ])}
      source={{
        ...source,
        agent: source.agent ?? 'unknown',
        paneKey,
        enabled: supported && controller.isRendererVisible,
        activityMap: true,
        activityMapOptions
      }}
      supported={supported}
      agentLabel={agentLabel}
      status={source.status}
      onClose={onClose}
    />
  )
}

function TerminalActivityMapSession({
  source,
  supported,
  agentLabel,
  status,
  onClose
}: {
  source: UseNativeChatLiveSessionArgs
  supported: boolean
  agentLabel: string
  status?: AgentStatusEntry
  onClose: () => void
}) {
  const t = useTranslate()
  const session = useNativeChatLiveSession(source)
  const modelChange = useActivityMapModelHistory({
    host: source.runtimeEnvironmentId,
    cwd: session.activityMap?.cwd,
    provider: source.agent,
    sessionId: source.sessionId,
    model: session.activityMap?.model,
    at: session.activityMap?.modelAt
  })
  const classification = useMemo(
    () => activityMapProviderClassification(source.activityMapOptions),
    [source.activityMapOptions]
  )
  const children = useMemo(
    () => terminalActivityChildWork(status, session.messages),
    [status, session.messages]
  )
  const events = useMemo(
    () =>
      supported
        ? mergeTerminalActivity(
            projectTerminalAgentActivityMap(session.messages, classification),
            [...(session.activityMap?.events ?? []), ...(modelChange ? [modelChange] : [])],
            children.events
          )
        : [],
    [supported, session.messages, session.activityMap, children.events, classification, modelChange]
  )
  return (
    <NativeChatActivityMap
      events={events}
      agentLabel={agentLabel}
      model={session.activityMap?.model ?? status?.model}
      working={supported && session.status === 'working'}
      live={source.enabled === true && session.readPhase === 'ready'}
      contextUsage={session.activityMap?.contextUsage ?? null}
      statistics={session.activityMap?.statistics}
      hostClock={
        session.activityMap
          ? { hostNow: session.activityMap.hostNow, receivedAt: session.activityMap.receivedAt }
          : null
      }
      subagentRoster={children.roster}
      notice={
        !supported
          ? t(
              'components.terminal.activityMap.unsupported',
              'Run a supported agent such as Codex or Claude in this terminal to see activity.'
            )
          : session.error
      }
      emptyMessage={t(
        'components.terminal.activityMap.empty',
        'Activity from this terminal will appear here as the agent works.'
      )}
      onClose={onClose}
    />
  )
}
