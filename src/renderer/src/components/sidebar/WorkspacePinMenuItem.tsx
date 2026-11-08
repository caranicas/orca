import { Pin, PinOff } from 'lucide-react'
import { useWorkspaceOrganization } from '@/store/workspace-organization'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import type { Worktree } from '../../../../shared/worktree/types'
import { getWorktreeHostIdentity } from '../../../../shared/worktree/host-qualified-identity'
import { useTranslate } from '@/i18n/use-translate'

export function WorkspacePinMenuItem({
  worktree,
  disabled,
  onToggle
}: {
  worktree: Worktree
  disabled: boolean
  onToggle: () => void
}) {
  const t = useTranslate()
  const identity = getWorktreeHostIdentity(worktree)
  const group = useWorkspaceOrganization((state) => state.grouping.memberships[identity])
  const removeGroup = useWorkspaceOrganization((state) => state.assignGroup)
  const pinned = worktree.isPinned || group !== undefined
  return (
    <DropdownMenuItem
      disabled={disabled}
      onSelect={() => {
        if (group) {
          removeGroup([identity], null)
        }
        if (!group || worktree.isPinned) {
          onToggle()
        }
      }}
    >
      {pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
      {pinned
        ? t('auto.components.sidebar.WorktreeContextMenu.697d0f6e1b', 'Unpin')
        : t('auto.components.sidebar.WorktreeContextMenu.3baa7d6507', 'Pin')}
    </DropdownMenuItem>
  )
}
