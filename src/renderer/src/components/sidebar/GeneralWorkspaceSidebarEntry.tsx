import { useRef, useState } from 'react'
import { Loader2, MessagesSquare } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { isPairedWebClientWindow } from '@/lib/desktop-window-chrome'
import { isGeneralWorkspaceRepo } from '../../../../shared/general-workspace'

export function GeneralWorkspaceSidebarEntry() {
  const active = useAppStore(
    (state) =>
      state.activeView === 'terminal' &&
      state.activeWorktreeId != null &&
      state.repos.some((repo) => repo.id === state.activeRepoId && isGeneralWorkspaceRepo(repo))
  )
  const [opening, setOpening] = useState(false)
  const openingRef = useRef(false)
  if (isPairedWebClientWindow()) {
    return null
  }
  const open = async () => {
    if (openingRef.current) {
      return
    }
    openingRef.current = true
    setOpening(true)
    try {
      const { openGeneralWorkspace } = await import('@/lib/open-general-workspace')
      await openGeneralWorkspace()
    } catch (error) {
      toast.error(translate('custom.general.error', 'Could not open General'), {
        description: error instanceof Error ? error.message : String(error)
      })
    } finally {
      openingRef.current = false
      setOpening(false)
    }
  }
  return (
    <button
      type="button"
      onClick={() => void open()}
      disabled={opening}
      aria-busy={opening}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium tracking-tight transition-colors disabled:opacity-50',
        active
          ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
          : 'text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-foreground/8'
      )}
    >
      {opening ? (
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        <MessagesSquare className="size-4 shrink-0" aria-hidden="true" />
      )}
      <span className="flex-1">{translate('custom.general.label', 'General')}</span>
    </button>
  )
}
