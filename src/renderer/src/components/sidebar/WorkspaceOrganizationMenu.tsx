import { Palette, Pin, Settings2 } from 'lucide-react'
import { useWorkspaceOrganization } from '@/store/workspace-organization'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu'
import type { Worktree } from '../../../../shared/worktree/types'
import { getWorktreeHostIdentity } from '../../../../shared/worktree/host-qualified-identity'
import { WORKSPACE_COLORS, WORKSPACE_COLOR_NAMES } from '../../../../shared/workspace-colors'
import { translate } from '@/i18n/i18n'

export function ManagePinnedGroupsMenuItem() {
  const open = useWorkspaceOrganization((state) => state.setManagerOpen)
  return (
    <DropdownMenuItem onSelect={() => open(true)}>
      <Settings2 className="size-3.5" />
      {translate('custom.pins.manage', 'Pinned groups')}
    </DropdownMenuItem>
  )
}

export function WorkspaceOrganizationMenu({
  worktrees,
  disabled,
  allowGrouping = true
}: {
  worktrees: readonly Worktree[]
  disabled: boolean
  allowGrouping?: boolean
}) {
  const groups = useWorkspaceOrganization((state) => state.grouping.groups)
  const assign = useWorkspaceOrganization((state) => state.assignGroup)
  const color = useWorkspaceOrganization((state) => state.setColor)
  const identities = worktrees.map(getWorktreeHostIdentity)
  return (
    <>
      {allowGrouping && (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={disabled}>
            <Pin className="size-3.5" />
            {translate('custom.pins.move', 'Move to pinned group')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {groups.map((group) => (
              <DropdownMenuItem key={group.id} onSelect={() => assign(identities, group.id)}>
                {group.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onSelect={() => assign(identities, null)}>
              {translate('custom.pins.removeMembership', 'Remove from pinned group')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <ManagePinnedGroupsMenuItem />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )}
      <DropdownMenuSub>
        <DropdownMenuSubTrigger disabled={disabled}>
          <Palette className="size-3.5" />
          {translate('custom.workspace.color', 'Workspace color')}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          {WORKSPACE_COLORS.map((value, index) => (
            <DropdownMenuItem key={value} onSelect={() => color(identities, value)}>
              <span
                aria-hidden="true"
                className="size-3 rounded-full"
                style={{ backgroundColor: value }}
              />
              {WORKSPACE_COLOR_NAMES[index]}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => color(identities, null)}>
            {translate('custom.workspace.noColor', 'No color')}
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  )
}
