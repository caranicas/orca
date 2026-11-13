import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { SerializeAddon } from '@xterm/addon-serialize'
import { defineFixture } from '../../../component-fixtures/component-fixture'
import { TerminalActivityMapLayout } from './TerminalActivityMapLayout'
import { useTerminalActivityMap } from './use-terminal-activity-map'
import TerminalPaneHeaderOverlay from '../titles/TerminalPaneHeaderOverlay'
import type { ManagedPane } from '@/lib/pane-manager/pane-manager-types'
import type { NativeChatMessage } from '../../../../../shared/native-chat/native-chat-types'
import { makePaneKey, parsePaneKey } from '../../../../../shared/workspace-layout/stable-pane-id'

const TAB = 'activity-terminal'
const LEAF = '178ab144-8acb-419e-943b-6b8d107bd7ac'
const PANE_KEY = makePaneKey(TAB, LEAF)
const MESSAGES: NativeChatMessage[] = [
  {
    id: 'calls',
    role: 'assistant',
    source: 'transcript',
    timestamp: 1000,
    blocks: [
      {
        type: 'tool-call',
        callId: 'read',
        name: 'Read',
        input: { file_path: '/project/AGENTS.md' },
        state: 'completed'
      },
      {
        type: 'tool-call',
        callId: 'shell',
        name: 'exec_command',
        input: { cmd: 'pnpm test' },
        state: 'running'
      }
    ]
  }
]

function TerminalFixture() {
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const [pane, setPane] = useState<ManagedPane | null>(null)
  const [width, setWidth] = useState(0)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const controller = {
    tabId: TAB,
    managedPanes: pane ? [pane] : [],
    isRendererVisible: true,
    resolveAgentForLeaf: () => 'codex'
  }
  const activityMap = useTerminalActivityMap(controller)
  useEffect(() => {
    if (!host) {
      return
    }
    const terminal = new Terminal({ fontSize: 13, cursorBlink: false })
    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(host)
    terminal.write('> OpenAI Codex\r\n\r\nReading project instructions and running checks.\r\n')
    const input = terminal.onData((data) => terminal.write(data))
    const observer = new ResizeObserver(() => {
      fitAddon.fit()
      setWidth(host.clientWidth)
    })
    observer.observe(host)
    setPane({
      id: 1,
      leafId: parsePaneKey(PANE_KEY)!.leafId,
      stablePaneId: parsePaneKey(PANE_KEY)!.leafId,
      terminal,
      container: host,
      fitAddon,
      linkTooltip: document.createElement('div'),
      searchAddon: new SearchAddon(),
      serializeAddon: new SerializeAddon()
    })
    return () => {
      observer.disconnect()
      input.dispose()
      terminal.dispose()
    }
  }, [host])
  return (
    <div className="relative h-160 bg-background text-foreground" data-terminal-tab-id={TAB}>
      <TerminalActivityMapLayout panel={activityMap.panel}>
        <div
          ref={setHost}
          className="absolute inset-0 overflow-hidden"
          data-activity-fixture-terminal=""
        />
        {pane ? (
          <TerminalPaneHeaderOverlay
            tabId={TAB}
            worktreeId="activity-workspace"
            cwd="/project"
            showAlwaysOnHeaders
            isTabPinned={false}
            paneCount={1}
            activePaneId={1}
            panes={[pane]}
            paneTitles={{}}
            paneTitleOverlayRects={{ 1: { left: 0, top: 0, width } }}
            renamingPaneId={null}
            renameValue=""
            renameInputRef={renameInputRef}
            titleUsesLightSurface={false}
            paneTitleBackground="var(--background)"
            terminalContentVisible
            hiddenStartupStyle={{}}
            managerRef={{ current: null }}
            paneTransportsRef={{ current: new Map() }}
            activityMapLeafId={activityMap.leafId}
            onToggleActivityMap={activityMap.toggle}
            onSplitPane={() => {}}
            onBeginPaneDrag={() => {}}
            onActivatePaneTitleInteraction={() => {}}
            onPaneTitleContextMenu={() => {}}
            onStartRename={() => {}}
            onRemoveTitle={() => {}}
            onClosePane={() => {}}
            onRenameValueChange={() => {}}
            onRenameSubmit={() => {}}
            onRenameCancel={() => {}}
            onRenameBlur={() => {}}
          />
        ) : null}
      </TerminalActivityMapLayout>
    </div>
  )
}

function fixture(width: number) {
  return defineFixture({
    width,
    store: {
      agentStatusByPaneKey: {
        [PANE_KEY]: {
          state: 'working',
          prompt: '',
          updatedAt: 1000,
          stateStartedAt: 1000,
          paneKey: PANE_KEY,
          stateHistory: [],
          agentType: 'codex',
          providerSession: { key: 'session_id', id: 'terminal-map-fixture' }
        }
      }
    },
    setup: () => {
      window.api.nativeChat.readSession = async () => ({ messages: MESSAGES })
      window.api.nativeChat.subscribe = (_args, onFrame) => {
        onFrame({ type: 'snapshot', messages: MESSAGES, hasMore: false })
        return () => {}
      }
    },
    render: () => <TerminalFixture />,
    interact: async (frame) => {
      const trigger = () =>
        frame.querySelector<HTMLButtonElement>('[data-terminal-activity-map-trigger]')
      if (!trigger()) {
        await new Promise<void>((resolve) => {
          const observer = new MutationObserver(() => {
            if (trigger()) {
              observer.disconnect()
              resolve()
            }
          })
          observer.observe(frame, { childList: true, subtree: true })
        })
      }
      trigger()?.click()
    }
  })
}

export const terminal = fixture(1100)
export const narrow = fixture(600)
