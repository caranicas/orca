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
import { NO_STRUCTURED_AGENT_SUBAGENT_ROSTER } from '../../../../../shared/agent-session/view/structured-agent-session-subagent-roster'
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
  const paneKey = makePaneKey(controller.tabId, leafId)
  const source = useAppStore(
    useShallow((state) => {
      const entry = state.agentStatusByPaneKey[paneKey]
      const shell = state.paneForegroundAgentByPaneKey[paneKey]?.shellForeground === true
      return {
        agent: shell ? null : (entry?.agentType ?? controller.resolveAgentForLeaf(leafId)),
        sessionId: shell ? null : resolvePaneAgentSessionId(state, paneKey),
        transcriptPath: shell ? null : (entry?.providerSession?.transcriptPath ?? null),
        runtimeEnvironmentId: selectNativeChatRuntimeEnvironmentId(state, controller.tabId)
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
        enabled: supported && controller.isRendererVisible
      }}
      supported={supported}
      agentLabel={agentLabel}
      onClose={onClose}
    />
  )
}

function TerminalActivityMapSession({
  source,
  supported,
  agentLabel,
  onClose
}: {
  source: UseNativeChatLiveSessionArgs
  supported: boolean
  agentLabel: string
  onClose: () => void
}) {
  const t = useTranslate()
  const session = useNativeChatLiveSession(source)
  const events = useMemo(
    () => (supported ? projectTerminalAgentActivityMap(session.messages) : []),
    [supported, session.messages]
  )
  return (
    <NativeChatActivityMap
      events={events}
      agentLabel={agentLabel}
      working={supported && session.status === 'working'}
      live={source.enabled === true && session.readPhase === 'ready'}
      contextUsage={null}
      subagentRoster={NO_STRUCTURED_AGENT_SUBAGENT_ROSTER}
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
