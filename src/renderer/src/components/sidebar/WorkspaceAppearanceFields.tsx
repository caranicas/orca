import { useState } from 'react'
import { useWorkspaceOrganization } from '@/store/workspace-organization'
import { getWorktreeHostIdentity } from '../../../../shared/worktree/host-qualified-identity'
import type { Worktree } from '../../../../shared/worktree/types'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { WorkspaceColorField } from './WorkspaceColorField'
import { translate } from '@/i18n/i18n'

export function useWorkspaceAppearanceDraft(worktree: Worktree | undefined) {
  const [initial] = useState(() => {
    const identity = worktree ? getWorktreeHostIdentity(worktree) : ''
    const state = useWorkspaceOrganization.getState()
    return {
      color: state.colors[identity] ?? null,
      group: state.grouping.memberships[identity] ?? null
    }
  })
  const [color, setColor] = useState<string | null>(initial.color)
  const [group, setGroup] = useState<string | null>(initial.group)
  return {
    color,
    setColor,
    group,
    setGroup,
    save: () => {
      if (!worktree) {
        return
      }
      const state = useWorkspaceOrganization.getState()
      const identity = getWorktreeHostIdentity(worktree)
      if (color !== initial.color) {
        state.setColor([identity], color)
      }
      if (group !== initial.group) {
        state.assignGroup([identity], group)
      }
    }
  }
}

export function WorkspaceAppearanceFields({
  draft,
  disabled,
  isFolderWorkspace
}: {
  draft: ReturnType<typeof useWorkspaceAppearanceDraft>
  disabled: boolean
  isFolderWorkspace: boolean
}) {
  const groups = useWorkspaceOrganization((state) => state.grouping.groups)
  const selectedGroup = groups.some((group) => group.id === draft.group) ? draft.group : null
  return (
    <>
      <WorkspaceColorField value={draft.color} onChange={draft.setColor} disabled={disabled} />
      {!isFolderWorkspace && groups.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="workspace-pinned-group">
            {translate('custom.pins.group', 'Pinned group')}
          </Label>
          <Select
            value={selectedGroup ?? 'none'}
            onValueChange={(value) => draft.setGroup(value === 'none' ? null : value)}
            disabled={disabled}
          >
            <SelectTrigger id="workspace-pinned-group">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                {translate('custom.pins.noGroup', 'No pinned group')}
              </SelectItem>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  )
}
