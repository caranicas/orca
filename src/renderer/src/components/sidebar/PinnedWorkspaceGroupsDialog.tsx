import { createNonSecureContextUuid as createBrowserUuid } from '../../../../shared/non-secure-context-uuid'
import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useWorkspaceOrganization } from '@/store/workspace-organization'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { useTranslate } from '@/i18n/use-translate'

function GroupEditor() {
  const t = useTranslate()
  const [groups, setGroups] = useState(() => [
    ...useWorkspaceOrganization.getState().grouping.groups
  ])
  const [error, setError] = useState<string | null>(null)
  const setOpen = useWorkspaceOrganization((state) => state.setManagerOpen)
  const saveGroups = useWorkspaceOrganization((state) => state.saveGroups)
  const move = (index: number, delta: number) =>
    setGroups((previous) => {
      const next = [...previous]
      const group = next.splice(index, 1)[0]
      if (group) {
        next.splice(index + delta, 0, group)
      }
      return next
    })
  const save = () => {
    if (groups.some((group) => !group.name.trim())) {
      setError(t('custom.pins.nameRequired', 'Give every group a name.'))
      return
    }
    try {
      saveGroups(groups)
      setOpen(false)
    } catch {
      setError(t('custom.pins.saveFailed', 'Could not save groups. Try again.'))
    }
  }
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
    >
      <DialogHeader>
        <DialogTitle>{t('custom.pins.manage', 'Pinned groups')}</DialogTitle>
        <DialogDescription>
          {t(
            'custom.pins.description',
            'Organize pinned workspaces across projects. Each group follows the sidebar sort order.'
          )}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        {groups.map((group, index) => (
          <div className="flex items-center gap-2" key={group.id}>
            <Input
              aria-label={t('custom.pins.groupName', 'Group name {{number}}', {
                number: index + 1
              })}
              value={group.name}
              maxLength={80}
              onChange={(event) =>
                setGroups((previous) =>
                  previous.map((entry) =>
                    entry.id === group.id ? { ...entry, name: event.target.value } : entry
                  )
                )
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t('custom.pins.moveUp', 'Move {{name}} up', { name: group.name })}
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              <ArrowUp />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t('custom.pins.moveDown', 'Move {{name}} down', {
                name: group.name
              })}
              disabled={index === groups.length - 1}
              onClick={() => move(index, 1)}
            >
              <ArrowDown />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t('custom.pins.remove', 'Remove group {{name}}', {
                name: group.name
              })}
              onClick={() =>
                setGroups((previous) => previous.filter((entry) => entry.id !== group.id))
              }
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setGroups((previous) => [...previous, { id: createBrowserUuid(), name: '' }])
          }
        >
          <Plus />
          {t('custom.pins.add', 'Add group')}
        </Button>
        <p className="text-xs text-muted-foreground">
          {t(
            'custom.pins.removalHint',
            'Removing a group keeps its workspaces. Groups and colors are saved in this app profile.'
          )}
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          {t('custom.pins.cancel', 'Cancel')}
        </Button>
        <Button type="submit">{t('custom.pins.save', 'Save')}</Button>
      </DialogFooter>
    </form>
  )
}

export function PinnedWorkspaceGroupsDialog() {
  const open = useWorkspaceOrganization((state) => state.managerOpen)
  const setOpen = useWorkspaceOrganization((state) => state.setManagerOpen)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent scrollable>{open && <GroupEditor />}</DialogContent>
    </Dialog>
  )
}
