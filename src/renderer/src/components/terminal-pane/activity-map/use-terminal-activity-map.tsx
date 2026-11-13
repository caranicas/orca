import { useState } from 'react'
import type { ManagedPane } from '@/lib/pane-manager/pane-manager-types'
import type { TerminalPaneController } from '../controller/use-terminal-pane-controller'
import { TerminalAgentActivityMap } from './TerminalAgentActivityMap'

export function useTerminalActivityMap(
  controller: Pick<
    TerminalPaneController,
    'tabId' | 'managedPanes' | 'isRendererVisible' | 'resolveAgentForLeaf'
  >
) {
  const [leafId, setLeafId] = useState<string | null>(null)
  const pane = controller.managedPanes.find((candidate) => candidate.leafId === leafId)
  const close = () => {
    setLeafId(null)
    const trigger =
      pane &&
      document.querySelector<HTMLButtonElement>(
        `[data-terminal-tab-id="${CSS.escape(controller.tabId)}"] [data-terminal-activity-map-trigger="${CSS.escape(pane.leafId)}"]`
      )
    trigger?.focus({ preventScroll: true })
  }
  return {
    leafId: pane?.leafId ?? null,
    toggle: (source: ManagedPane) =>
      setLeafId((current) => (current === source.leafId ? null : source.leafId)),
    panel: pane ? (
      <TerminalAgentActivityMap
        key={pane.leafId}
        controller={controller}
        leafId={pane.leafId}
        onClose={close}
      />
    ) : null
  }
}
