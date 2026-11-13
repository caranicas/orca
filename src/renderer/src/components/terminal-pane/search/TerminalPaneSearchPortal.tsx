import { createPortal } from 'react-dom'
import TerminalSearch from '@/components/TerminalSearch'
import type { TerminalPaneController } from '../controller/use-terminal-pane-controller'

export function TerminalPaneSearchPortal({
  controller
}: {
  controller: Pick<
    TerminalPaneController,
    'activePane' | 'searchOpen' | 'setSearchOpen' | 'searchStateRef' | 'searchInputRef'
  >
}) {
  const { activePane, searchOpen, setSearchOpen, searchStateRef, searchInputRef } = controller
  return activePane?.container
    ? createPortal(
        <TerminalSearch
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
          searchAddon={activePane.searchAddon ?? null}
          searchStateRef={searchStateRef}
          inputRef={searchInputRef}
        />,
        activePane.container
      )
    : null
}
