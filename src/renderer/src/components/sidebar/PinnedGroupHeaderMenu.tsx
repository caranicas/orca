import { Ellipsis } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { ManagePinnedGroupsMenuItem } from './WorkspaceOrganizationMenu'
import {
  handleRepoHeaderActionPointerDown,
  stopRepoHeaderKeyboardToggle,
  stopRepoHeaderMenuEvent
} from './worktree-list/rows/header-event-guards'
import { useTranslate } from '@/i18n/use-translate'

export function PinnedGroupHeaderMenu() {
  const t = useTranslate()
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          data-repo-header-action=""
          aria-label={t('custom.pins.actions', 'Pinned group actions')}
          onPointerDown={handleRepoHeaderActionPointerDown}
          onClick={stopRepoHeaderMenuEvent}
          onKeyDown={stopRepoHeaderKeyboardToggle}
        >
          <Ellipsis className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onPointerDown={stopRepoHeaderMenuEvent}
        onClick={stopRepoHeaderMenuEvent}
        onKeyDown={stopRepoHeaderMenuEvent}
      >
        <ManagePinnedGroupsMenuItem />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
